import { pool } from "../db.js";
import AppError from "../utils/appError.js";
const createAccount = async (req, res, next) => {
  const { currency, kind } = req.body;
  const ownerId = req.params.id;
  const { rows } = await pool.query(
    `INSERT INTO accounts (owner_id, currency, kind)
     VALUES ($1, $2, $3)
     RETURNING id, owner_id, currency, kind, balance_cached, created_at`,
    [ownerId, currency, kind],
  );
  res.status(201).json({ status: "success", data: rows[0] });
};
const getAccountById = async (req, res, next) => {
  const { rows } = await pool.query(
    "SELECT id, owner_id, currency, kind, balance_cached, created_at FROM accounts WHERE id = $1 AND owner_id = $2",
    [req.params.id, req.user.id],
  );
  if (rows.lenght === 0) {
    return next(new AppError("there is no accounts with this id", 404, ""));
  }
  res.status(200).json({ status: "success", data: rows[0] });
};
// Keyset-paginated statement, newest first.
// Uses entries_account_id_idx (account_id, id): WHERE account_id = $1 AND id < cursor ORDER BY id DESC.
const getStatement = async (req, res, next) => {
  const { params, query } = req.validated;
  const { cursor, limit } = query;

  // Ownership check: customers see only their own accounts, auditors see all.
  // 404 instead of 403 so we don't reveal which account ids exist.
  const { rows: accounts } = await pool.query(
    `SELECT id, currency, balance_cached FROM accounts
     WHERE id = $1 AND (owner_id = $2 OR $3 = 'auditor')`,
    [params.id, req.user.id, req.user.role],
  );
  if (accounts.length === 0) {
    return next(
      new AppError(
        "there is no account with this id",
        404,
        "ACCOUNT_NOT_FOUND",
      ),
    );
  }

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
    [params.id, cursor ?? null, limit + 1],
  );

  const hasMore = rows.length > limit;
  const entries = hasMore ? rows.slice(0, limit) : rows;
  // bigint columns come back from pg as strings, keeping money exact.
  const nextCursor = hasMore ? entries[entries.length - 1].id : null;

  res.status(200).json({
    status: "success",
    data: {
      account: accounts[0],
      entries,
      next_cursor: nextCursor,
    },
  });
};
export default { getStatement, createAccount, getAccountById };
