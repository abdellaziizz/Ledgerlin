// Row locks (READ COMMITTED + SELECT ... FOR UPDATE in id order) vs SERIALIZABLE + retry.
// Fires the same contended workload at both modes and reports throughput, retries and failures.
// DESTRUCTIVE (creates users, accounts and transfers): point it at a throwaway database.
//   DATABASE_URL=postgres://... node scripts/bench-isolation.js
import crypto from "crypto";
import { pool } from "../db.js";
import { createTransfer } from "../services/transferService.js";

const TRANSFERS = Number(process.env.BENCH_TRANSFERS || 400);
const ACCOUNTS = Number(process.env.BENCH_ACCOUNTS || 4); // few accounts = high contention

async function setup() {
  const { rows: [u] } = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id",
    [`bench-${crypto.randomUUID()}@ledgerline.local`],
  );
  const { rows } = await pool.query(
    "INSERT INTO accounts (owner_id, currency, kind) SELECT $1, 'EGP', 'system' FROM generate_series(1, $2) RETURNING id",
    [u.id, ACCOUNTS],
  );
  return { userId: u.id, ids: rows.map((r) => Number(r.id)) };
}

async function run(mode) {
  const { userId, ids } = await setup();
  const retries = { "40001": 0, "40P01": 0 };
  const failures = {};
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: TRANSFERS }, async (_, i) => {
      // Random pairs in both directions: the worst case for lock ordering and for SSI.
      const from = ids[i % ids.length];
      const to = ids[(i * 7 + 1 + Math.floor(i / ids.length)) % ids.length];
      if (from === to) return;
      try {
        await createTransfer({
          userId,
          idempotencyKey: crypto.randomUUID(),
          requestHash: crypto.randomUUID(),
          input: { from_account_id: from, to_account_id: to, amount_minor: 1 + (i % 50), currency: "EGP" },
          mode,
          onRetry: (code) => retries[code]++,
        });
      } catch (err) {
        const code = err.code ?? "unknown";
        failures[code] = (failures[code] ?? 0) + 1;
      }
    }),
  );
  const ms = performance.now() - t0;
  const { rows: [ok] } = await pool.query(
    "SELECT count(DISTINCT transfer_id)::int AS n FROM entries e JOIN accounts a ON a.id = e.account_id WHERE a.owner_id = $1",
    [userId],
  );
  const { rows: [drift] } = await pool.query("SELECT count(*)::int AS n FROM balance_drift");
  return { mode, committed: ok.n, ms: Math.round(ms), tps: Math.round((ok.n / ms) * 1000), retries, failures, drift: drift.n };
}

console.log(`${TRANSFERS} concurrent transfers across ${ACCOUNTS} accounts, pool size ${pool.options.max ?? 10}\n`);
console.log("| Mode | Committed | Wall time | Transfers/s | Retries (40001 / 40P01) | Failed after retries | Drifted accounts |");
console.log("|---|---|---|---|---|---|---|");
for (const mode of ["locks", "serializable"]) {
  const r = await run(mode);
  const failed = Object.entries(r.failures).map(([k, v]) => `${v} × ${k}`).join(", ") || "0";
  console.log(`| ${r.mode} | ${r.committed} | ${r.ms} ms | ${r.tps} | ${r.retries["40001"]} / ${r.retries["40P01"]} | ${failed} | ${r.drift} |`);
}
await pool.end();
