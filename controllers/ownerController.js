import { pool } from "../db.js";
import AppError from "../utils/appError.js";

/**
 * Loads :id into req.account if the caller may see it: customers only their own accounts,
 * auditors any account. Returns 404 (not 403) so account ids can't be probed.
 * Used by GET /accounts/:id and GET /accounts/:id/statement.
 */
const loadAccount = async (req, res, next) => {
  const id = req.validated?.params?.id ?? req.params.id;
  const { rows } = await pool.query(
    `SELECT id, owner_id, currency, kind, balance_cached, created_at
       FROM accounts
      WHERE id = $1 AND (owner_id = $2 OR $3 = 'auditor')`,
    [id, req.user.id, req.user.role],
  );
  if (rows.length === 0) {
    return next(new AppError("there is no account with this id", 404, "ACCOUNT_NOT_FOUND"));
  }
  req.account = rows[0];
  next();
};

export default { loadAccount };
