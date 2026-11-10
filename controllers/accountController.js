import { pool } from "../db.js";
import { audit } from "../services/auditService.js";

const ACCOUNT_COLUMNS = "id, owner_id, currency, kind, balance_cached, created_at";

// Customers open wallets only; system (counterparty) accounts come from the seed script.
const createAccount = async (req, res) => {
  const { currency } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO accounts (owner_id, currency, kind)
     VALUES ($1, $2, 'wallet')
     RETURNING ${ACCOUNT_COLUMNS}`,
    [req.user.id, currency],
  );
  await audit(null, { actorId: req.user.id, action: "account.created", entityType: "account", entityId: rows[0].id, metadata: { currency } });
  res.status(201).json({ status: "success", data: rows[0] });
};

// Customers see their own accounts; auditors see every account.
const listAccounts = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_COLUMNS} FROM accounts
      WHERE owner_id = $1 OR $2 = 'auditor'
      ORDER BY id`,
    [req.user.id, req.user.role],
  );
  res.status(200).json({ status: "success", data: rows });
};

// req.account is loaded and ownership-checked by ownerController.loadAccount.
const getAccountById = async (req, res) => {
  res.status(200).json({ status: "success", data: req.account });
};

// Keyset-paginated statement, newest first.
// Uses entries_account_id_idx (account_id, id): WHERE account_id = $1 AND id < cursor ORDER BY id DESC.
const getStatement = async (req, res) => {
  const { cursor, limit } = req.validated.query;
  const account = req.account;

  // Fetch one extra row to know whether another page exists.
  const { rows } = await pool.query(
    `SELECT e.id, e.transfer_id, e.direction, e.amount_minor,
            CASE e.direction WHEN 'credit' THEN e.amount_minor ELSE -e.amount_minor END AS signed_amount_minor,
            t.description, t.created_at
       FROM entries e
       JOIN transfers t ON t.id = e.transfer_id
      WHERE e.account_id = $1
        AND ($2::bigint IS NULL OR e.id < $2::bigint)
      ORDER BY e.id DESC
      LIMIT $3`,
    [account.id, cursor ?? null, limit + 1],
  );

  const hasMore = rows.length > limit;
  const entries = hasMore ? rows.slice(0, limit) : rows;
  // bigint columns come back from pg as strings, keeping money exact.
  const nextCursor = hasMore ? entries[entries.length - 1].id : null;

  res.status(200).json({
    status: "success",
    data: {
      account: { id: account.id, currency: account.currency, balance_cached: account.balance_cached },
      entries,
      next_cursor: nextCursor,
    },
  });
};

export default { createAccount, listAccounts, getAccountById, getStatement };
