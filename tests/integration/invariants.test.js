import { describe, expect, it } from "vitest";
import { pool } from "../../db.js";
import { fund, makeTreasury, openWallet, registerUser } from "../helpers.js";

// Each test attacks an invariant with raw SQL, bypassing the application entirely,
// and expects PostgreSQL itself to refuse.
async function ledgerWithOneTransfer() {
  const u = await registerUser();
  const wallet = await openWallet(u.auth);
  const treasury = await makeTreasury();
  const t = await fund(treasury, wallet.id, 10_000);
  const { rows } = await pool.query("SELECT id FROM entries WHERE transfer_id = $1 ORDER BY id", [t.body.data.id]);
  return { wallet, treasury, transferId: t.body.data.id, entryIds: rows.map((r) => r.id) };
}

async function inTx(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await fn(c);
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

describe("database invariants (raw SQL)", () => {
  it("entries are immutable: UPDATE fails", async () => {
    const { entryIds } = await ledgerWithOneTransfer();
    await expect(pool.query("UPDATE entries SET amount_minor = 1 WHERE id = $1", [entryIds[0]])).rejects.toMatchObject({
      code: "23000",
      message: expect.stringContaining("append-only"),
    });
  });

  it("entries are immutable: DELETE and TRUNCATE fail", async () => {
    const { entryIds } = await ledgerWithOneTransfer();
    await expect(pool.query("DELETE FROM entries WHERE id = $1", [entryIds[0]])).rejects.toMatchObject({ code: "23000" });
    await expect(pool.query("TRUNCATE entries CASCADE")).rejects.toMatchObject({ code: "23000" });
  });

  it("an unbalanced transfer is rejected at COMMIT by the deferred trigger", async () => {
    const { wallet, treasury } = await ledgerWithOneTransfer();
    await expect(
      inTx(async (c) => {
        const { rows } = await c.query("INSERT INTO transfers (description) VALUES ('forged') RETURNING id");
        await c.query(
          `INSERT INTO entries (transfer_id, account_id, amount_minor, direction)
           VALUES ($1, $2, 500, 'debit'), ($1, $3, 900, 'credit')`,
          [rows[0].id, treasury.accountId, wallet.id],
        );
      }),
    ).rejects.toMatchObject({ code: "23514", message: expect.stringContaining("unbalanced") });
  });

  it("a one-sided transfer (single entry) is rejected at COMMIT", async () => {
    const { wallet } = await ledgerWithOneTransfer();
    await expect(
      inTx(async (c) => {
        const { rows } = await c.query("INSERT INTO transfers DEFAULT VALUES RETURNING id");
        await c.query("INSERT INTO entries (transfer_id, account_id, amount_minor, direction) VALUES ($1, $2, 100, 'credit')", [rows[0].id, wallet.id]);
      }),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("a wallet balance can never go negative", async () => {
    const { wallet } = await ledgerWithOneTransfer();
    await expect(pool.query("UPDATE accounts SET balance_cached = -1 WHERE id = $1", [wallet.id])).rejects.toMatchObject({
      code: "23514",
      constraint: "wallet_non_negative",
    });
  });

  it("a system account may go negative (it is the counterparty)", async () => {
    const { treasury } = await ledgerWithOneTransfer();
    const { rows } = await pool.query("SELECT balance_cached FROM accounts WHERE id = $1", [treasury.accountId]);
    expect(BigInt(rows[0].balance_cached)).toBeLessThan(0n);
  });

  it("entry amounts must be positive (the sign lives in direction)", async () => {
    const { transferId, wallet } = await ledgerWithOneTransfer();
    await expect(
      pool.query("INSERT INTO entries (transfer_id, account_id, amount_minor, direction) VALUES ($1, $2, 0, 'credit')", [transferId, wallet.id]),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("an idempotency key can only be claimed once per user", async () => {
    const u = await registerUser();
    const insert = () =>
      pool.query("INSERT INTO idempotency_keys (user_id, key, request_hash) VALUES ($1, 'dup-key', 'h')", [u.user.id]);
    await insert();
    await expect(insert()).rejects.toMatchObject({ code: "23505" });
  });

  it("currency codes must be three upper-case letters", async () => {
    const u = await registerUser();
    await expect(
      pool.query("INSERT INTO accounts (owner_id, currency) VALUES ($1, 'egp')", [u.user.id]),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("the audit log is append-only", async () => {
    await ledgerWithOneTransfer();
    await expect(pool.query("UPDATE audit_log SET action = 'x'")).rejects.toMatchObject({ code: "23000" });
    await expect(pool.query("DELETE FROM audit_log")).rejects.toMatchObject({ code: "23000" });
  });
});
