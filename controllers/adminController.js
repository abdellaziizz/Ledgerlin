import { pool } from "../db.js";
const reconcile = async (req, res, next) => {
  const accountId = req.params.id;
  const result = await pool.query(
    `SELECT *
   FROM balance_drift
   WHERE account_id = $1`,
    [accountId],
  );
  if (result.rows.length === 0) {
    return res.status(200).json({
      status: "success",
      data: {
        reconciled: true,
        accountId: id,
      },
    });
  }
  const drift = result.rows[0];
};

export default reconcile;
