// Double-spend chaos test against a RUNNING API (e.g. `docker compose up`).
// Hammers one wallet with concurrent transfers — duplicate Idempotency-Keys, opposite directions,
// more total than the balance — then checks that nothing was double-spent and the ledger reconciles.
//   API_URL=http://localhost:8080 node scripts/chaos-double-spend.js
const API = (process.env.API_URL || "http://localhost:3000").replace(/\/$/, "") + "/api/v1";
const ROUNDS = Number(process.env.CHAOS_REQUESTS || 300);

async function call(method, path, { token, body, key } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, replayed: res.headers.get("idempotent-replayed") === "true", body: await res.json().catch(() => null) };
}
const login = async (email, password) => (await call("POST", "/auth/login", { body: { email, password } })).body.token;

const token = await login(process.env.CHAOS_EMAIL || "demo@ledgerline.dev", process.env.CHAOS_PASSWORD || "demo-pass-123");
const auditor = await login("auditor@ledgerline.dev", "audit-pass-123");
const accounts = (await call("GET", "/accounts", { token })).body.data.filter((a) => a.currency === "EGP" && a.kind === "wallet");
if (accounts.length < 2) throw new Error("need two EGP wallets for the demo user (run the seed)");
const [a, b] = accounts;
const before = { a: BigInt(a.balance_cached), b: BigInt(b.balance_cached) };
const spendable = before.a + before.b;
const amount = Number(spendable / 40n) || 1; // ~40 transfers would drain both wallets

console.log(`chaos: ${ROUNDS} concurrent requests, amount ${amount}, wallets #${a.id}=${before.a} #${b.id}=${before.b}`);

// Every 5 requests share one key, so the server must replay 4 of each 5.
const runId = Date.now().toString(36);
const keyOf = (i) => `chaos-${runId}-${Math.floor(i / 5)}`;
const requests = Array.from({ length: ROUNDS }, (_, i) => {
  const forward = Math.floor(i / 5) % 2 === 0;
  const [from, to] = forward ? [a, b] : [b, a];
  return call("POST", "/transfers", {
    token,
    key: keyOf(i),
    body: { from_account_id: Number(from.id), to_account_id: Number(to.id), amount_minor: amount, currency: "EGP", description: `chaos #${Math.floor(i / 5)}` },
  });
});
const results = await Promise.all(requests);

const tally = {};
for (const r of results) {
  const k = r.status === 201 ? (r.replayed ? "201 replayed" : "201 executed") : `${r.status} ${r.body?.code}`;
  tally[k] = (tally[k] ?? 0) + 1;
}
console.table(tally);

const after = Object.fromEntries(
  (await call("GET", "/accounts", { token })).body.data.filter((x) => x.id === a.id || x.id === b.id).map((x) => [x.id, BigInt(x.balance_cached)]),
);
const recon = (await call("POST", "/admin/reconcile", { token: auditor })).body.data;
// For each key: how many distinct transfers did its 201 responses point at? Must be exactly 1.
const transfersPerKey = new Map();
results.forEach((r, i) => {
  if (r.status !== 201) return;
  const set = transfersPerKey.get(keyOf(i)) ?? new Set();
  set.add(r.body.data.id);
  transfersPerKey.set(keyOf(i), set);
});

const checks = {
  "no wallet below zero": after[a.id] >= 0n && after[b.id] >= 0n,
  "money conserved between the two wallets": after[a.id] + after[b.id] === spendable,
  "each key moved money at most once": [...transfersPerKey.values()].every((s) => s.size === 1) &&
    (tally["201 executed"] ?? 0) === transfersPerKey.size,
  "ledger reconciles (cached == derived, transfers balanced)": recon.reconciled,
};
console.table(Object.fromEntries(Object.entries(checks).map(([k, v]) => [k, v ? "PASS" : "FAIL"])));
process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
