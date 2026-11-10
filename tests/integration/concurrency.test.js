import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { pool } from "../../db.js";
import { reconcile } from "../../services/reconcileService.js";
import { createTransfer } from "../../services/transferService.js";
import { balanceOf, derivedBalanceOf, fund, key, makeTreasury, openWallet, registerUser, transferReq } from "../helpers.js";

async function twoFundedWallets(amountA, amountB = 0) {
  const alice = await registerUser("alice");
  const a = await openWallet(alice.auth);
  const b = await openWallet(alice.auth);
  const treasury = await makeTreasury();
  if (amountA) await fund(treasury, a.id, amountA);
  if (amountB) await fund(treasury, b.id, amountB);
  return { alice, a, b };
}

async function assertLedgerConsistent(...accountIds) {
  for (const id of accountIds) {
    const cached = await balanceOf(id);
    expect(cached).toBeGreaterThanOrEqual(0n);
    expect(cached).toBe(await derivedBalanceOf(id));
  }
  const { rows } = await pool.query(
    "SELECT COALESCE(SUM(CASE direction WHEN 'credit' THEN amount_minor ELSE -amount_minor END), 0) AS net FROM entries",
  );
  expect(BigInt(rows[0].net)).toBe(0n); // money is neither created nor destroyed
  const result = await reconcile();
  expect(result.reconciled).toBe(true);
}

describe("concurrent transfers (row locks in id order)", () => {
  it("fires 100 concurrent transfers from one account: never negative, exactly the affordable ones succeed", async () => {
    const { alice, a, b } = await twoFundedWallets(500_000); // affords exactly 50 x 10_000
    const body = { from_account_id: Number(a.id), to_account_id: Number(b.id), amount_minor: 10_000, currency: "EGP" };

    const results = await Promise.all(Array.from({ length: 100 }, () => transferReq(alice.auth, key(), body)));

    const ok = results.filter((r) => r.status === 201).length;
    const insufficient = results.filter((r) => r.status === 422 && r.body.code === "INSUFFICIENT_FUNDS").length;
    expect(ok).toBe(50);
    expect(insufficient).toBe(50);
    expect(await balanceOf(a.id)).toBe(0n);
    expect(await balanceOf(b.id)).toBe(500_000n);
    await assertLedgerConsistent(a.id, b.id);
  });

  it("runs opposite transfers (A->B and B->A) concurrently without deadlocking", async () => {
    const { alice, a, b } = await twoFundedWallets(1_000_000, 1_000_000);
    const ab = { from_account_id: Number(a.id), to_account_id: Number(b.id), amount_minor: 1_000, currency: "EGP" };
    const ba = { from_account_id: Number(b.id), to_account_id: Number(a.id), amount_minor: 700, currency: "EGP" };

    const results = await Promise.all(
      Array.from({ length: 60 }, (_, i) => transferReq(alice.auth, key(), i % 2 ? ab : ba)),
    );

    expect(results.map((r) => r.status)).toEqual(Array(60).fill(201)); // no 503 RETRY (deadlock) responses
    expect(await balanceOf(a.id)).toBe(1_000_000n - 30n * 1_000n + 30n * 700n);
    await assertLedgerConsistent(a.id, b.id);
  });

  it("reproduces the deadlock that lock ordering prevents", async () => {
    const { a, b } = await twoFundedWallets(0);
    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      await c1.query("BEGIN");
      await c2.query("BEGIN");
      await c1.query("SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE", [a.id]); // c1 locks A
      await c2.query("SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE", [b.id]); // c2 locks B
      // Each now waits for the other's row: Postgres detects the cycle and aborts one.
      const results = await Promise.allSettled([
        c1.query("SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE", [b.id]),
        c2.query("SELECT 1 FROM accounts WHERE id = $1 FOR UPDATE", [a.id]),
      ]);
      const codes = results.filter((r) => r.status === "rejected").map((r) => r.reason.code);
      expect(codes).toEqual(["40P01"]);
    } finally {
      await c1.query("ROLLBACK").catch(() => {});
      await c2.query("ROLLBACK").catch(() => {});
      c1.release();
      c2.release();
    }
  });
});

describe("concurrent transfers (SERIALIZABLE + retry on 40001)", () => {
  it("keeps every invariant under contention; failures are clean retries, never corruption", async () => {
    const { alice, a, b } = await twoFundedWallets(200_000); // affords 20 x 10_000
    const input = { from_account_id: Number(a.id), to_account_id: Number(b.id), amount_minor: 10_000, currency: "EGP" };

    const results = await Promise.allSettled(
      Array.from({ length: 40 }, () =>
        createTransfer({ userId: alice.user.id, idempotencyKey: key(), requestHash: crypto.randomUUID(), input, mode: "serializable" }),
      ),
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const reasons = results.filter((r) => r.status === "rejected").map((r) => r.reason.code ?? r.reason.statusCode);
    // Every failure is either "insufficient funds" or a serialization failure that ran out of retries.
    expect(reasons.every((c) => c === "INSUFFICIENT_FUNDS" || c === "40001" || c === "40P01")).toBe(true);
    expect(ok).toBeGreaterThan(0);
    expect(ok).toBeLessThanOrEqual(20);
    expect(await balanceOf(a.id)).toBe(200_000n - BigInt(ok) * 10_000n);
    await assertLedgerConsistent(a.id, b.id);
  });
});
