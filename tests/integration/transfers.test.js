import { describe, expect, it } from "vitest";
import { balanceOf, derivedBalanceOf, fund, key, makeTreasury, openWallet, registerUser, transferReq } from "../helpers.js";

async function setup(amount = 100_000) {
  const alice = await registerUser("alice");
  const bob = await registerUser("bob");
  const a = await openWallet(alice.auth);
  const b = await openWallet(bob.auth);
  const treasury = await makeTreasury();
  if (amount) await fund(treasury, a.id, amount);
  return { alice, bob, a, b };
}
const body = (from, to, amount_minor, currency = "EGP") => ({
  from_account_id: Number(from), to_account_id: Number(to), amount_minor, currency, description: "test",
});

describe("transfers", () => {
  it("moves money, posts a balanced pair and keeps cached == derived balances", async () => {
    const { alice, a, b } = await setup(100_000);
    const res = await transferReq(alice.auth, key(), body(a.id, b.id, 25_050)).expect(201);
    expect(res.body.data).toMatchObject({ from_account_id: a.id, to_account_id: b.id, amount_minor: "25050", currency: "EGP" });
    expect(await balanceOf(a.id)).toBe(74_950n);
    expect(await balanceOf(b.id)).toBe(25_050n);
    expect(await derivedBalanceOf(a.id)).toBe(74_950n);
    expect(await derivedBalanceOf(b.id)).toBe(25_050n);
  });

  it("prevents overdraft with 422 INSUFFICIENT_FUNDS and changes nothing", async () => {
    const { alice, a, b } = await setup(1_000);
    const res = await transferReq(alice.auth, key(), body(a.id, b.id, 1_001)).expect(422);
    expect(res.body.code).toBe("INSUFFICIENT_FUNDS");
    expect(await balanceOf(a.id)).toBe(1_000n);
  });

  it("refuses to send from someone else's account (404)", async () => {
    const { bob, a, b } = await setup();
    const res = await transferReq(bob.auth, key(), body(a.id, b.id, 1)).expect(404);
    expect(res.body.code).toBe("ACCOUNT_NOT_FOUND");
  });

  it("rejects a currency mismatch", async () => {
    const { alice, a } = await setup();
    const usd = await openWallet(alice.auth, "USD");
    const res = await transferReq(alice.auth, key(), body(a.id, usd.id, 1)).expect(400);
    expect(res.body.code).toBe("CURRENCY_MISMATCH");
  });

  it("requires an Idempotency-Key", async () => {
    const { alice, a, b } = await setup();
    const { api } = await import("../helpers.js");
    const res = await api().post("/api/v1/transfers").set(alice.auth).send(body(a.id, b.id, 1)).expect(400);
    expect(res.body.code).toBe("IDEMPOTENCY_KEY_MISSING");
  });

  it("rejects float amounts before touching the database", async () => {
    const { alice, a, b } = await setup();
    const res = await transferReq(alice.auth, key(), body(a.id, b.id, 10.5)).expect(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
