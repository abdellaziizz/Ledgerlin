import { describe, expect, it } from "vitest";
import { api, fund, makeAuditor, makeTreasury, openWallet, registerUser } from "../helpers.js";

describe("accounts and ownership", () => {
  it("opens a wallet with a zero balance and lists only the caller's accounts", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const a = await openWallet(alice.auth, "egp");
    expect(a).toMatchObject({ currency: "EGP", kind: "wallet", balance_cached: "0", owner_id: alice.user.id });
    await openWallet(bob.auth, "USD");

    const list = await api().get("/api/v1/accounts").set(alice.auth).expect(200);
    expect(list.body.data.map((x) => x.id)).toEqual([a.id]);
  });

  it("refuses to let a customer open a system account", async () => {
    const u = await registerUser();
    await api().post("/api/v1/accounts").set(u.auth).send({ currency: "EGP", kind: "system" }).expect(400);
  });

  it("returns 404 for another user's account on every account route", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");
    const bobs = await openWallet(bob.auth);
    for (const path of [`/api/v1/accounts/${bobs.id}`, `/api/v1/accounts/${bobs.id}/statement`]) {
      const res = await api().get(path).set(alice.auth).expect(404);
      expect(res.body.code).toBe("ACCOUNT_NOT_FOUND");
    }
    await api().get(`/api/v1/accounts/${bobs.id}`).set(bob.auth).expect(200);
  });

  it("lets an auditor read any account", async () => {
    const bob = await registerUser("bob");
    const bobs = await openWallet(bob.auth);
    const auditor = await makeAuditor();
    await api().get(`/api/v1/accounts/${bobs.id}`).set(auditor.auth).expect(200);
    const all = await api().get("/api/v1/accounts").set(auditor.auth).expect(200);
    expect(all.body.data.some((x) => x.id === bobs.id)).toBe(true);
  });

  it("paginates the statement with a keyset cursor: newest first, no gaps, no duplicates", async () => {
    const u = await registerUser();
    const wallet = await openWallet(u.auth);
    const treasury = await makeTreasury();
    for (let i = 1; i <= 23; i++) await fund(treasury, wallet.id, i * 100);

    const seen = [];
    let cursor;
    let pages = 0;
    do {
      const res = await api()
        .get(`/api/v1/accounts/${wallet.id}/statement`)
        .query({ limit: 10, ...(cursor ? { cursor } : {}) })
        .set(u.auth)
        .expect(200);
      seen.push(...res.body.data.entries);
      cursor = res.body.data.next_cursor;
      pages++;
    } while (cursor);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(23);
    const ids = seen.map((e) => BigInt(e.id));
    expect(new Set(ids).size).toBe(23);
    expect(ids).toEqual([...ids].sort((a, b) => (a > b ? -1 : 1)));
    expect(seen.every((e) => e.direction === "credit" && BigInt(e.signed_amount_minor) > 0n)).toBe(true);
    const total = seen.reduce((s, e) => s + BigInt(e.amount_minor), 0n);
    expect(total).toBe(27600n); // 100 + 200 + ... + 2300
  });
});
