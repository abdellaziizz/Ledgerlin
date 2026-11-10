import { describe, expect, it } from "vitest";
import { pool } from "../../db.js";
import { balanceOf, fund, key, makeTreasury, openWallet, registerUser, transferReq } from "../helpers.js";

async function setup(amount = 1_000_000) {
  const alice = await registerUser("alice");
  const a = await openWallet(alice.auth);
  const b = await openWallet(alice.auth);
  await fund(await makeTreasury(), a.id, amount);
  return { alice, a, b };
}
const body = (a, b, amount_minor) => ({ from_account_id: Number(a.id), to_account_id: Number(b.id), amount_minor, currency: "EGP" });
const transfersWithKey = async (userId, k) =>
  (await pool.query("SELECT response_body FROM idempotency_keys WHERE user_id = $1 AND key = $2", [userId, k])).rows;

describe("Idempotency-Key semantics", () => {
  it("replays the same key 20 times in parallel and creates exactly one transfer", async () => {
    const { alice, a, b } = await setup();
    const k = key();
    const before = (await pool.query("SELECT count(*)::int AS n FROM entries WHERE account_id = $1", [a.id])).rows[0].n;

    const responses = await Promise.all(Array.from({ length: 20 }, () => transferReq(alice.auth, k, body(a, b, 5_000))));

    expect(responses.map((r) => r.status)).toEqual(Array(20).fill(201));
    const ids = new Set(responses.map((r) => r.body.data.id));
    expect(ids.size).toBe(1); // every caller got the same transfer
    expect(responses.filter((r) => r.headers["idempotent-replayed"] === "true")).toHaveLength(19);

    const after = (await pool.query("SELECT count(*)::int AS n FROM entries WHERE account_id = $1", [a.id])).rows[0].n;
    expect(after - before).toBe(1); // one debit entry: money moved once
    expect(await balanceOf(a.id)).toBe(995_000n);
    expect(await balanceOf(b.id)).toBe(5_000n);
  });

  it("rejects a reused key with different parameters (422) without moving money", async () => {
    const { alice, a, b } = await setup();
    const k = key();
    await transferReq(alice.auth, k, body(a, b, 1_000)).expect(201);
    const res = await transferReq(alice.auth, k, body(a, b, 2_000)).expect(422);
    expect(res.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await balanceOf(b.id)).toBe(1_000n);
  });

  it("does not save validation failures: the key stays free", async () => {
    const { alice, a, b } = await setup();
    const k = key();
    await transferReq(alice.auth, k, { ...body(a, b, 1_000), amount_minor: 1.5 }).expect(400);
    expect(await transfersWithKey(alice.user.id, k)).toHaveLength(0);
    await transferReq(alice.auth, k, body(a, b, 1_000)).expect(201);
  });

  it("rolls back the key with a failed transfer, so the same key can be retried later", async () => {
    const { alice, a, b } = await setup(1_000);
    const k = key();
    await transferReq(alice.auth, k, body(a, b, 5_000)).expect(422); // insufficient funds
    expect(await transfersWithKey(alice.user.id, k)).toHaveLength(0);
    await fund(await makeTreasury(), a.id, 10_000);
    await transferReq(alice.auth, k, body(a, b, 5_000)).expect(201);
  });

  it("scopes keys per user: two users may use the same key", async () => {
    const one = await setup();
    const two = await setup();
    const k = "shared-key-123";
    await transferReq(one.alice.auth, k, body(one.a, one.b, 100)).expect(201);
    const res = await transferReq(two.alice.auth, k, body(two.a, two.b, 100)).expect(201);
    expect(res.headers["idempotent-replayed"]).toBeUndefined();
  });
});
