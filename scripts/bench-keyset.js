// Keyset vs OFFSET pagination on a 1M-row entries table, measured with EXPLAIN (ANALYZE, BUFFERS).
// DESTRUCTIVE: bulk-loads ~1M rows. Point it at a throwaway database:
//   BENCH_DATABASE_URL=postgres://... node scripts/bench-keyset.js > docs/keyset-benchmark-raw.txt
// Results are summarised in docs/keyset-pagination.md.
import pg from "pg";

const url = process.env.BENCH_DATABASE_URL;
if (!url) {
  console.error("Set BENCH_DATABASE_URL to a disposable database (this script loads 1M rows).");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();

const TRANSFERS = 500_000; // x2 entries = 1,000,000 rows
const ACCOUNTS = 50;
const PAGE = 50;
const DEEP_OFFSET = 100_000;

const q = (sql, params) => client.query(sql, params);
const log = (...a) => console.log(...a);

const { rows: [existing] } = await q("SELECT count(*)::int AS n FROM entries");
if (existing.n < 1_000_000) {
  log(`loading ${TRANSFERS * 2} entries...`);
  const t0 = Date.now();
  await q("BEGIN");
  const { rows: [u] } = await q(
    "INSERT INTO users (email, password_hash) VALUES ('bench@ledgerline.local', 'x') ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id",
  );
  await q(
    "INSERT INTO accounts (owner_id, currency, kind) SELECT $1, 'EGP', 'system' FROM generate_series(1, $2)",
    [u.id, ACCOUNTS + 1], // the last one is the "quiet" account
  );
  // Bulk load: skip the per-row balance trigger (superuser only). The data is balanced by
  // construction — each transfer is one debit and one equal credit — and the trigger is
  // re-enabled before any measurement.
  await q("SET LOCAL session_replication_role = replica");
  await q(
    `WITH acc AS (SELECT array_agg(id ORDER BY id) AS ids FROM accounts WHERE owner_id = $1),
          quiet AS (SELECT max(id) AS id FROM accounts WHERE owner_id = $1),
          t AS (
            INSERT INTO transfers (created_at, description)
            SELECT now() - make_interval(secs => ($2 - g)), 'bench #' || g FROM generate_series(1, $2) g
            RETURNING id
          )
     -- One hot account (a busy merchant) is the debit side of every third transfer;
     -- the other legs are spread over the remaining accounts.
     INSERT INTO entries (transfer_id, account_id, amount_minor, direction)
     SELECT t.id,
            CASE WHEN d.direction = 'debit'
                 THEN CASE WHEN t.id % 3 = 0 THEN acc.ids[1] ELSE acc.ids[2 + (t.id % ($3 - 1))] END
                 WHEN t.id <= 40 THEN quiet.id -- a quiet account: 40 credits, all among the oldest rows
                 ELSE acc.ids[2 + ((t.id + 7) % ($3 - 1))] END,
            100 + (t.id % 997),
            d.direction::entry_direction
       FROM t, acc, quiet, (VALUES ('debit'), ('credit')) AS d(direction)
      ORDER BY t.id, d.direction DESC`,
    [u.id, TRANSFERS, ACCOUNTS],
  );
  await q("COMMIT");
  await q("ANALYZE");
  log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// The hottest account: the one with the most entries.
const { rows: [hot] } = await q("SELECT account_id, count(*)::int AS n FROM entries GROUP BY 1 ORDER BY 2 DESC LIMIT 1");
const { rows: [quiet] } = await q("SELECT max(id) AS id FROM accounts");
const { rows: [cursorRow] } = await q(
  "SELECT id FROM entries WHERE account_id = $1 ORDER BY id DESC OFFSET $2 LIMIT 1",
  [hot.account_id, DEEP_OFFSET - 1],
);
const { rows: [ctCursor] } = await q(
  `SELECT t.created_at, e.id FROM entries e JOIN transfers t ON t.id = e.transfer_id
    WHERE e.account_id = $1 ORDER BY t.created_at DESC, e.id DESC OFFSET $2 LIMIT 1`,
  [hot.account_id, DEEP_OFFSET - 1],
);
log(`entries: ${(await q("SELECT count(*)::int AS n FROM entries")).rows[0].n}; account ${hot.account_id} has ${hot.n} entries; deep page starts after row ${DEEP_OFFSET}`);

const STATEMENT = `SELECT e.id, e.transfer_id, e.direction, e.amount_minor, t.description, t.created_at
  FROM entries e JOIN transfers t ON t.id = e.transfer_id WHERE e.account_id = $1`;

const cases = [
  ["OFFSET, first page", `${STATEMENT} ORDER BY e.id DESC LIMIT ${PAGE}`, [hot.account_id]],
  ["OFFSET, deep page", `${STATEMENT} ORDER BY e.id DESC OFFSET ${DEEP_OFFSET} LIMIT ${PAGE}`, [hot.account_id]],
  ["Keyset id < cursor, first page", `${STATEMENT} ORDER BY e.id DESC LIMIT ${PAGE}`, [hot.account_id]],
  ["Keyset id < cursor, deep page", `${STATEMENT} AND e.id < $2 ORDER BY e.id DESC LIMIT ${PAGE}`, [hot.account_id, cursorRow.id]],
  ["Keyset first page, quiet account (40 old entries)", `${STATEMENT} ORDER BY e.id DESC LIMIT ${PAGE}`, [quiet.id]],
  [
    "Keyset (created_at, id) < cursor, deep page",
    `${STATEMENT} AND (t.created_at, e.id) < ($2, $3) ORDER BY t.created_at DESC, e.id DESC LIMIT ${PAGE}`,
    [hot.account_id, ctCursor.created_at, ctCursor.id],
  ],
];

async function explain(label, sql, params) {
  // Warm once, then measure.
  await q(`EXPLAIN (ANALYZE) ${sql}`, params);
  const { rows } = await q(`EXPLAIN (ANALYZE, BUFFERS) ${sql}`, params);
  const text = rows.map((r) => r["QUERY PLAN"]).join("\n");
  const ms = Number(text.match(/Execution Time: ([\d.]+) ms/)[1]);
  const hit = [...text.matchAll(/shared hit=(\d+)/g)].map((m) => Number(m[1]));
  const read = [...text.matchAll(/read=(\d+)/g)].map((m) => Number(m[1]));
  const buffers = (hit[0] ?? 0) + (read[0] ?? 0);
  log(`\n### ${label}\n\n${text}`);
  return { label, ms, buffers, plan: text.split("\n")[0].trim() };
}

const summary = [];
log("\n## With entries_account_id_idx (account_id, id)");
for (const c of cases) summary.push({ index: "yes", ...(await explain(...c)) });

log("\n## Without the (account_id, id) index (dropped inside a rolled-back transaction)");
await q("BEGIN");
await q("DROP INDEX entries_account_id_idx");
for (const c of [cases[1], cases[3], cases[4]]) summary.push({ index: "no", ...(await explain(...c)) });
await q("ROLLBACK");

log("\n## Summary\n\n| Query | (account_id, id) index | Execution time | Buffers (top node) |\n|---|---|---|---|");
for (const s of summary) log(`| ${s.label} | ${s.index} | ${s.ms.toFixed(2)} ms | ${s.buffers} |`);
await client.end();
