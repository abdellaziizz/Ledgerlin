import { describe, expect, it } from "vitest";
import { pool } from "../../db.js";
import { api, fund, makeAuditor, makeTreasury, openWallet, registerUser } from "../helpers.js";

describe("reconciliation", () => {
  it("is auditor-only", async () => {
    const u = await registerUser();
    const res = await api().post("/api/v1/admin/reconcile").set(u.auth).expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("reports a clean ledger, then catches a tampered cached balance", async () => {
    const auditor = await makeAuditor();
    const u = await registerUser();
    const wallet = await openWallet(u.auth);
    await fund(await makeTreasury(), wallet.id, 50_000);

    const clean = await api().post("/api/v1/admin/reconcile").set(auditor.auth).send({ account_id: wallet.id }).expect(200);
    expect(clean.body.data).toMatchObject({ reconciled: true, accounts_checked: 1, drifted_accounts: [] });

    // Simulate a bug that updates the cache without posting entries.
    await pool.query("UPDATE accounts SET balance_cached = balance_cached + 999 WHERE id = $1", [wallet.id]);
    const drift = await api().post("/api/v1/admin/reconcile").set(auditor.auth).send({ account_id: wallet.id }).expect(200);
    expect(drift.body.data.reconciled).toBe(false);
    expect(drift.body.data.drifted_accounts).toEqual([
      { account_id: wallet.id, balance_cached: "50999", balance_derived: "50000", difference: "999" },
    ]);

    // Undo so later suites see a consistent ledger, and confirm the run was audited.
    await pool.query("UPDATE accounts SET balance_cached = balance_cached - 999 WHERE id = $1", [wallet.id]);
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM audit_log WHERE action = 'reconcile.run' AND actor_id = $1", [auditor.user.id]);
    expect(rows[0].n).toBe(2);
  });
});
