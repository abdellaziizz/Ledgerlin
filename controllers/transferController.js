import { withTransaction } from "../db.js";
import AppError from "../utils/appError.js";
import { hashRequest } from "../middleware/idempotencyKey.js";
// i need to update the two accounts and also record the transfer and its own ledger entires
// Steps:
//0.claim the idempotency key (or replay the stored response)
//1.check if the sender and receiver are different
//2.check if the amount is positive
//3.Lock both accounts using the SELECT FOR UPDATE to prevent concurent transfer from modification
//4.ensure the sender and receiver using the same currency and have sufficient funds

//5.create the transfer
//6.insert debit entry to sender and credit for reciver
//7.update cached_balance
//8.save the idempotency response
const createTransfer = async (req, res, next) => {
  const { from_account_id, to_account_id, amount_minor, currency, description } =
    req.body;
  // 1 + 2 are also enforced by transferSchema; kept as a second line of defence.
  if (String(from_account_id) === String(to_account_id))
    throw new AppError("sender and receiver are the same account", 400, "SAME_ACCOUNT");
  if (!(amount_minor > 0)) {
    throw new AppError("amount must be positive", 400, "INVALID_AMOUNT");
  }
  const requestHash = hashRequest(req);

  const result = await withTransaction(async (client) => {
    // 0. Claim the key. The primary key (user_id, key) makes this atomic: a parallel
    // request with the same key blocks here until we commit, then sees our row.
    const claim = await client.query(
      `INSERT INTO idempotency_keys (user_id, key, request_hash, locked_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, key) DO NOTHING
       RETURNING key`,
      [req.user.id, req.idempotencyKey, requestHash],
    );
    if (claim.rows.length === 0) {
      const { rows } = await client.query(
        `SELECT request_hash, response_code, response_body
           FROM idempotency_keys WHERE user_id = $1 AND key = $2`,
        [req.user.id, req.idempotencyKey],
      );
      const stored = rows[0];
      if (stored.request_hash !== requestHash) {
        throw new AppError(
          "Idempotency-Key was already used with different parameters",
          422,
          "IDEMPOTENCY_KEY_REUSED",
        );
      }
      if (stored.response_code === null) {
        throw new AppError(
          "A request with this Idempotency-Key is still in progress",
          409,
          "IDEMPOTENCY_IN_PROGRESS",
        );
      }
      return {
        code: stored.response_code,
        body: stored.response_body,
        replayed: true,
      };
    }

    // 3. Lock both rows in ascending id order so A->B and B->A can't deadlock.
    const accountResult = await client.query(
      `SELECT id, owner_id, currency, kind, balance_cached
         FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE`,
      [from_account_id, to_account_id],
    );
    // pg returns bigint ids as strings, so compare as strings.
    const sender = accountResult.rows.find(
      (account) => account.id === String(from_account_id),
    );
    const receiver = accountResult.rows.find(
      (account) => account.id === String(to_account_id),
    );
    // Only the owner may send money; 404 so we don't reveal other users' accounts.
    if (!sender || sender.owner_id !== req.user.id) {
      throw new AppError("Sender account not found", 404, "ACCOUNT_NOT_FOUND");
    }
    if (!receiver) {
      throw new AppError("Receiver account not found", 404, "ACCOUNT_NOT_FOUND");
    }

    // 4. Currency and overdraft checks (wallet_non_negative CHECK is the backstop).
    if (sender.currency !== receiver.currency || sender.currency !== currency) {
      throw new AppError("Account currencies do not match", 400, "CURRENCY_MISMATCH");
    }
    if (
      sender.kind !== "system" &&
      BigInt(sender.balance_cached) < BigInt(amount_minor)
    ) {
      throw new AppError("Insufficient funds", 422, "INSUFFICIENT_FUNDS");
    }

    // 5. Create the transfer.
    const { rows: transferRows } = await client.query(
      `INSERT INTO transfers (description) VALUES ($1)
       RETURNING id, created_at, description`,
      [description ?? null],
    );
    const transfer = transferRows[0];

    // 6. Balanced pair of entries; the deferred entries_balanced trigger checks them at COMMIT.
    await client.query(
      `INSERT INTO entries (transfer_id, account_id, amount_minor, direction)
       VALUES ($1, $2, $4, 'debit'), ($1, $3, $4, 'credit')`,
      [transfer.id, sender.id, receiver.id, amount_minor],
    );

    // 7. Update cached balances in the same transaction.
    await client.query(
      `UPDATE accounts SET balance_cached = balance_cached - $2 WHERE id = $1`,
      [sender.id, amount_minor],
    );
    await client.query(
      `UPDATE accounts SET balance_cached = balance_cached + $2 WHERE id = $1`,
      [receiver.id, amount_minor],
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

    // 8. Store the response so retries with this key replay it instead of moving money again.
    await client.query(
      `UPDATE idempotency_keys
          SET response_code = $3, response_body = $4, locked_at = NULL
        WHERE user_id = $1 AND key = $2`,
      [req.user.id, req.idempotencyKey, 201, body],
    );

    return { code: 201, body, replayed: false };
  });

  if (result.replayed) res.set("Idempotent-Replayed", "true");
  res.status(result.code).json(result.body);
};

export default { createTransfer };
