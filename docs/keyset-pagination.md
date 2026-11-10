# Keyset pagination: benchmark and index design

`GET /accounts/:id/statement?cursor=&limit=` pages through an account's entries newest-first:

```sql
SELECT e.id, e.transfer_id, e.direction, e.amount_minor, t.description, t.created_at
  FROM entries e JOIN transfers t ON t.id = e.transfer_id
 WHERE e.account_id = $1
   AND ($2::bigint IS NULL OR e.id < $2)   -- cursor = last id of the previous page
 ORDER BY e.id DESC
 LIMIT $3 + 1;                              -- one extra row says whether another page exists
```

## Setup

- PostgreSQL 18 (Docker `postgres:18-alpine`), default config, warm cache (each query run once
  before measuring).
- `entries`: **1,000,000 rows** (500,000 balanced transfers), loaded by `scripts/bench-keyset.js`.
- A **hot** account with 166,666 entries (a busy merchant), and a **quiet** account with 40
  entries that are all among the oldest rows.
- Page size 50. "Deep page" means after the first 100,000 rows of the hot account.
- Reproduce:
  `BENCH_DATABASE_URL=postgres://… node scripts/bench-keyset.js`.
  Full `EXPLAIN (ANALYZE, BUFFERS)` output is in [`keyset-benchmark-raw.txt`](keyset-benchmark-raw.txt).

## Results

| Query | `(account_id, id)` index | Execution time | Buffers |
|---|---|---|---|
| OFFSET, first page | yes | 0.28 ms | 208 |
| **OFFSET, deep page (offset 100,000)** | yes | **130.88 ms** | **13,875** (+ temp spill to disk) |
| Keyset `id < cursor`, first page | yes | 0.11 ms | 208 |
| **Keyset `id < cursor`, deep page** | yes | **0.12 ms** | **207** |
| Keyset first page, quiet account | yes | 0.08 ms | 165 |
| Keyset `(created_at, id) < cursor`, deep page | yes | 98.22 ms | 12,682 |
| OFFSET, deep page | **no** | 142.17 ms | 13,235 |
| Keyset `id < cursor`, deep page (hot account) | **no** | 0.19 ms | 207 |
| **Keyset first page, quiet account** | **no** | **36.08 ms** | **8,508** |

## What the plans show

**OFFSET gets slower the deeper you go.** To return rows 100,001–100,050, Postgres must produce and
throw away the first 100,000. The plan is a parallel hash join of all 166,666 of the account's
entries with `transfers`, a sort that spills to disk (`temp read=1209 written=1356`), then `Limit`.
That costs about 1,000× the work of the first page. It is also unstable: rows inserted while the user
pages shift every later page, so entries get skipped or repeated.

**Keyset has the same cost on every page.** `id < cursor` turns "skip N rows" into "start at this
key". The plan is an index range scan that reads 50 rows and stops:

```
Limit (actual time=0.023..0.103 rows=50)
  -> Nested Loop
       -> Index Scan Backward using entries_pkey on entries e
            Index Cond: (id < '400001'::bigint)
            Filter: (account_id = '1'::bigint)
       -> Index Scan using transfers_pkey on transfers t
```

Page 1 and page 2,000 both read about 207 buffers. Inserts can't shift a page, because the
cursor is a value, not a position.

**Why `(created_at, id)` was not used.** The spec suggests `WHERE (created_at, id) < ($1, $2)`.
In this schema `created_at` lives on `transfers`, so the row comparison spans a join and no single
index can satisfy it. The plan falls back to a hash join and sort (98 ms). `entries.id` is a
monotonic identity assigned at insert, so it is already in posting order. Paging on it gives the
same ordering using one index. If `created_at` were needed (for example a date filter), the fix
would be to denormalise it onto `entries` and index `(account_id, created_at, id)`.

**Why the `(account_id, id)` index exists (EXPLAIN-driven).** For the hot account the planner
doesn't even use it: the account's rows are dense, so walking the primary key backwards and
filtering finds 50 matches almost immediately. The quiet account is the opposite. Its 40 entries are
the oldest rows in the table, so without the index Postgres has no better option than reading the
whole table and sorting what's left:

```
-- without entries_account_id_idx: 36.08 ms, 8,508 buffers
Sort  (Sort Key: e.id DESC)
  -> Parallel Seq Scan on entries e          (3 workers)
       Filter: (account_id = '51'::bigint)
       Rows Removed by Filter: 333320         (per worker: ~1M rows read in total)

-- with entries_account_id_idx: 0.08 ms, 165 buffers
Index Scan Backward using entries_account_id_idx on entries e
  Index Cond: (account_id = '51'::bigint)    (reads exactly the 40 rows)
```

Most real accounts are quiet. Without the index, the cost of a statement would depend on how much
*everyone else* has transacted since this account's last entry. With it, cost depends only on the
page size. The index is `(account_id, id)`, not `(account_id)`, so the ordering and the cursor
condition are both served by the index with no sort.

## Takeaways

1. Use keyset pagination for anything a user can page through. OFFSET is fine only for small, bounded lists.
2. Choose a cursor column that is unique and in the order you display; here that is `entries.id`.
3. Size the index for the worst account, not the average one. The quiet account is what proves the
   composite index is necessary.
