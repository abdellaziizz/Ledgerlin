import { json } from "zod";
import { pool, withTransaction } from "../db.js";
import AppError from "../utils/appError.js";
// i need to update the two accounts and also record the transfer and its own ledger entires
// Steps:
//1.check if the sender and receiver are different
//2.check if the amount is positive
//3.Lock both accounts using the SELECT FOR UPDATE to prevent concurent transfer from modification

//4.ensure the sender and receiver using the same currency and have sufficient funds
//5.create the transfer
//6.insert debit entry to sender and credit for reciver
//7.update cached_balance
//8.save the idempotency response
const createTransfer = async (req, res, next) => {
  const { from_account_id, to_account_id, amount_minor, currency } = req.body;
  if (String(from_account_id) === String(to_account_id))
    throw new AppError("sender and receiver are the same person", 400);
  if (amount_minor < 0) {
    throw new AppError("amount cannot be negative", 400);
  }
  const result = await withTransaction(async (client) => {
    const accountResult = client.query(
      `SELECT id, owner_id, currency, balance_cached FROM accounts WHERE id IN ($1 , $2) ORDER BY id FOR UPDATE`,
      [from_account_id, to_account_id],
    );
    if (accountResult.rows.length !== 2) {
      throw new AppError("Sender or receiver account not found", 404);
    }
    const sender = accountResult.rows.find((account) => {
      account.id === from_account_id;
    });
    const receiver = accountResult.rows.find((account) => {
      account.id === to_account_id;
    });
  });

  res.status(200).json({ status: "success", data: result.rows[0] });
};
