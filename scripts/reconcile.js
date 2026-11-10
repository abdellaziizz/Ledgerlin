// Reconciliation job: exits 1 if any cached balance differs from its entries or any transfer
// doesn't net to zero. Run it from cron / CI:  node scripts/reconcile.js
import { pool } from "../db.js";
import { reconcile } from "../services/reconcileService.js";

try {
  const result = await reconcile();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.reconciled ? 0 : 1;
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
