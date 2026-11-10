import config from "../config.js";
import { withTransaction } from "../db.js";
import AppError from "../utils/appError.js";
import { audit } from "./auditService.js";

const RETRYABLE = new Set(["40001", "40P01"]); // serialization_failure, deadlock_detected
const MAX_ATTEMPTS = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One transfer = one database transaction:
 *   0. claim the idempotency key (or replay the stored response)
 *   1. read both accounts — locked in ascending id order (locks mode) or under SERIALIZABLE
 *   2. ownership, currency and overdraft checks
 *   3. insert the transfer and a balanced debit/credit pair (checked again by a deferred trigger)
 *   4. update both cached balances
 *   5. store the response against the key, write the audit row, commit
 *
 * Because everything happens in a single transaction there are no foreign side effects to
 * recover from: if the process dies, Postgres rolls the whole thing back, including the key
 * claim, and a retry simply runs again. That is why Brandur-style recovery points aren't needed.
 *
 * Returns { code, body, replayed }.
 */
export async function createTransfer({ userId, idempotencyKey, requestHash, input, mode = config.transferMode, onRetry }) {
  const isolation = mode === "serializable" ? "serializable" : undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      return await withTransaction(
        (client) => runTransfer(client, { userId, idempotencyKey, requestHash, input, lock: mode !== "serializable" }),
        { isolation },
      );
    } catch (err) {
      // Under SERIALIZABLE, Postgres aborts one of two conflicting transactions with 40001;
      // the whole transaction is safe to re-run. 40P01 is retried for the same reason.
      if (RETRYABLE.has(err.code) && attempt < MAX_ATTEMPTS) {
        onRetry?.(err.code, attempt);
        await sleep(Math.random() * 10 * attempt);
        continue;
      }
      throw err;
    }
  }
}

async function runTransfer(client, { userId, idempotencyKey, requestHash, input, lock }) {
  const { from_account_id, to_account_id, amount_minor, currency, description } = input;

  if (String(from_account_id) === String(to_account_id)) {
    throw new AppError("sender and receiver are the same account", 400, "SAME_ACCOUNT");
  }
  if (!(amount_minor > 0)) throw new AppError("amount must be positive", 400, "INVALID_AMOUNT");

  // 0. Claim the key. The (user_id, key) primary key makes this atomic: a parallel request
  // with the same key blocks on the unique index until we commit, then sees our stored row.
  const claim = await client.query(
    `INSERT INTO idempotency_keys (user_id, key, request_hash, locked_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, key) DO NOTHING
     RETURNING key`,
    [userId, idempotencyKey, requestHash],
  );
  if (claim.rows.length === 0) {
    const { rows } = await client.query(
      `SELECT request_hash, response_code, response_body
         FROM idempotency_keys WHERE user_id = $1 AND key = $2`,
      [userId, idempotencyKey],
    );
    const stored = rows[0];
    if (stored.request_hash !== requestHash) {
      throw new AppError("Idempotency-Key was already used with different parameters", 422, "IDEMPOTENCY_KEY_REUSED");
    }
    if (stored.response_code === null) {
      // Unreachable while the claim and the response commit together; kept as a guard
      // for any future flow that commits the claim before finishing (e.g. external payouts).
      throw new AppError("A request with this Idempotency-Key is still in progress", 409, "IDEMPOTENCY_IN_PROGRESS");
    }
    return { code: stored.response_code, body: stored.response_body, replayed: true };
  }

  // 1. Read both accounts. In locks mode, FOR UPDATE in ascending id order means A->B and
  // B->A always lock the lower id first, so they queue instead of deadlocking.
  const { rows: accounts } = await client.query(
    `SELECT id, owner_id, currency, kind, balance_cached
       FROM accounts WHERE id IN ($1, $2) ORDER BY id ${lock ? "FOR UPDATE" : ""}`,
    [from_account_id, to_account_id],
  );
  // pg returns bigint ids as strings, so compare as strings.
  const sender = accounts.find((a) => a.id === String(from_account_id));
  const receiver = accounts.find((a) => a.id === String(to_account_id));

  // 2. Only the owner may send; 404 so we don't reveal other users' accounts.
  if (!sender || sender.owner_id !== userId) throw new AppError("Sender account not found", 404, "ACCOUNT_NOT_FOUND");
  if (!receiver) throw new AppError("Receiver account not found", 404, "ACCOUNT_NOT_FOUND");
  if (sender.currency !== receiver.currency || sender.currency !== currency) {
    throw new AppError("Account currencies do not match", 400, "CURRENCY_MISMATCH");
  }
  // The wallet_non_negative CHECK is the backstop; this gives a clean 422 first.
  if (sender.kind !== "system" && BigInt(sender.balance_cached) < BigInt(amount_minor)) {
    throw new AppError("Insufficient funds", 422, "INSUFFICIENT_FUNDS");
  }

  // 3. Transfer + balanced entries. entries_balanced (DEFERRABLE INITIALLY DEFERRED) re-checks at COMMIT.
  const { rows: transferRows } = await client.query(
    `INSERT INTO transfers (description) VALUES ($1) RETURNING id, created_at, description`,
    [description ?? null],
  );
  const transfer = transferRows[0];
  await client.query(
    `INSERT INTO entries (transfer_id, account_id, amount_minor, direction)
     VALUES ($1, $2, $4, 'debit'), ($1, $3, $4, 'credit')`,
    [transfer.id, sender.id, receiver.id, amount_minor],
  );

  // 4. Cached balances, in the same transaction (and the same id order as the locks).
  await client.query(
    `UPDATE accounts
        SET balance_cached = balance_cached + CASE WHEN id = $1 THEN -$3::bigint ELSE $3::bigint END
      WHERE id IN ($1, $2)`,
    [sender.id, receiver.id, amount_minor],
  );

  const body = {
    status: "success",
    data: {
      id: transfer.id,
      from_account_id: sender.id,
      to_account_id: receiver.id,
      amount_minor: String(amount_minor),
      currency: sender.currency,
      description: transfer.description,
      created_at: transfer.created_at,
    },
  };

  // 5. Store the response so retries replay it instead of moving money again.
  await client.query(
    `UPDATE idempotency_keys
        SET response_code = $3, response_body = $4, locked_at = NULL
      WHERE user_id = $1 AND key = $2`,
    [userId, idempotencyKey, 201, body],
  );
  await audit(client, {
    actorId: userId,
    action: "transfer.created",
    entityType: "transfer",
    entityId: transfer.id,
    metadata: { from: sender.id, to: receiver.id, amount_minor: String(amount_minor), currency: sender.currency, idempotency_key: idempotencyKey },
  });

  return { code: 201, body, replayed: false };
}
