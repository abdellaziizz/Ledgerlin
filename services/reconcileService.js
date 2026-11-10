import { pool } from "../db.js";
import { audit } from "./auditService.js";

/**
 * Proves the cached-balance design is safe: every account's balance_cached must equal the
 * sum of its entries (balance_drift view), and every transfer must net to zero per currency.
 * Read-only apart from the audit row. Pass accountId to check a single account.
 */
export async function reconcile({ actorId = null, accountId = null } = {}) {
  const params = accountId ? [accountId] : [];
  const where = accountId ? "WHERE account_id = $1" : "";
  const [{ rows: drift }, { rows: checked }, { rows: unbalanced }] = await Promise.all([
    pool.query(`SELECT account_id, balance_cached, balance_derived FROM balance_drift ${where} ORDER BY account_id`, params),
    pool.query(`SELECT count(*)::int AS n FROM accounts ${accountId ? "WHERE id = $1" : ""}`, params),
    pool.query(
      `SELECT e.transfer_id
         FROM entries e JOIN accounts a ON a.id = e.account_id
        GROUP BY e.transfer_id, a.currency
       HAVING SUM(CASE e.direction WHEN 'credit' THEN e.amount_minor ELSE -e.amount_minor END) <> 0
        LIMIT 100`,
    ),
  ]);

  const result = {
    reconciled: drift.length === 0 && unbalanced.length === 0,
    accounts_checked: checked[0].n,
    drifted_accounts: drift.map((d) => ({
      account_id: d.account_id,
      balance_cached: String(d.balance_cached),
      balance_derived: String(d.balance_derived),
      difference: String(BigInt(d.balance_cached) - BigInt(d.balance_derived)),
    })),
    unbalanced_transfers: unbalanced.map((u) => u.transfer_id),
    checked_at: new Date().toISOString(),
  };

  await audit(null, {
    actorId,
    action: "reconcile.run",
    entityType: accountId ? "account" : null,
    entityId: accountId,
    metadata: { reconciled: result.reconciled, accounts_checked: result.accounts_checked, drifted: result.drifted_accounts.length },
  });
  return result;
}
