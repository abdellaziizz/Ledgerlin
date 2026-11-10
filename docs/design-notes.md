# Design notes

A working log of decisions, the bugs hit while building Ledgerline, and how each was found and fixed.
Every bug below has a test or a script that reproduces it.

---

## Bugs hit

### 1. The API didn't start: route handler was `undefined`

**Symptom.** `node server.js` crashed while loading `app.js`:
`TypeError: argument handler must be a function`.

**Cause.** `adminController.js` did `export default reconcile`, but `adminRoutes.js` called
`adminController.reconcile`, which is `undefined`. Express 5 rejects `undefined` handlers when the
route is registered, so the whole app fails at import time, not when the route is hit. The
controller also read `req.params.id` on a route without `:id`, referenced an undeclared `id`, and
never sent a response when drift was found.

**Fix.** The controller exports `{ reconcile }`. The logic moved to `services/reconcileService.js`,
which is shared by the HTTP route and the `scripts/reconcile.js` job. It checks every account (or
one, via `account_id` in the body), reports transfers that don't net to zero, and writes an audit row.

**Proved by.** `tests/integration/reconcile.test.js` (auditor-only, clean ledger, tampered balance detected).

### 2. `GET /accounts/:id` returned 500 for every id

**Symptom.** `column "role" does not exist`.

**Cause.** The query was
`WHERE id = $1 AND owner_id = $2 OR role = $3`. `role` is a column of `users`, not `accounts`. Even
if it had existed, `AND` binds tighter than `OR`, so the condition reads
`(id AND owner) OR role`: an auditor would have matched every row and got an arbitrary account
back instead of the one requested.

**Fix.** One ownership middleware, `controllers/ownerController.loadAccount`, that the old stub file
described. It is used by both account routes and returns 404 (not 403) for accounts you can't see:

```sql
WHERE id = $1 AND (owner_id = $2 OR $3 = 'auditor')
```

**Proved by.** `accounts.test.js`: "returns 404 for another user's account on every account route".

### 3. Customers could mint money

**Cause.** `createAccountSchema` accepted `kind: "system"`. System accounts are exempt from
`wallet_non_negative`, so a customer could open one and transfer from it into their own wallet
without limit.

**Fix.** The schema only accepts `"wallet"`, and the controller hard-codes it. System accounts come
from the seed script only.

**Proved by.** `accounts.test.js` ("refuses to let a customer open a system account") and the unit
test in `schemas.test.js`.

### 4. Reproduced deadlock: why the accounts are locked in id order

Two opposite transfers, A→B and B→A, each lock their sender first. Each then waits for the other's
row, and Postgres aborts one with `40P01 deadlock_detected`.

`concurrency.test.js` → "reproduces the deadlock that lock ordering prevents" does exactly this with
two raw connections and asserts one of them gets `40P01`.

**Fix.** `SELECT … FROM accounts WHERE id IN ($1, $2) ORDER BY id FOR UPDATE` always locks the
lower id first, whichever direction the money moves. Two transfers on the same pair then queue
instead of forming a cycle. "runs opposite transfers concurrently without deadlocking" fires 60
mixed A→B / B→A transfers and asserts all 60 return 201.

### 5. SERIALIZABLE false positives from the balance trigger

Under `TRANSFER_MODE=serializable`, transfers between **completely disjoint** account pairs
(no shared account at all) were being aborted with `40001`.

**Investigation.** Capturing `err.detail` and `err.where` showed every failure inside the deferred
`entries_balanced` trigger:

```
40001 Reason code: Canceled on conflict out to pivot 1494, during read.
SQL statement "SELECT a.currency, SUM(…) FROM entries e JOIN accounts a …"
```

The trigger joined `entries` to `accounts`. On a small `accounts` table the planner sequentially
scans it, and under SERIALIZABLE a sequential scan takes a predicate lock on the **whole
relation**. Every concurrent transfer updates two `accounts` rows, so every pair of transfers looked
like a read/write conflict.

**Fix.** Migration `003_balanced_trigger_ssi_friendly.sql` keeps the same rule but looks up each
entry's account by primary key, so it only takes tuple-level predicate locks.

| 200 concurrent transfers on disjoint pairs, SERIALIZABLE | Failed after 5 retries |
|---|---|
| Before 003 | 127 |
| After 003 | 0 |

### 6. Stack traces leaked in client errors

In development, `errorController` returned `stack` for every error, including 400s and 404s. That
exposed file paths to any client of a dev server. Stacks are now only included for 5xx in
development and never in production.

### 7. Login revealed which emails exist (timing)

Login only ran `bcrypt.compare` when the email existed. "Unknown email" skipped the cost-12 hash
and answered measurably faster than "wrong password", which lets an attacker enumerate registered
emails. Login now compares against a dummy cost-12 hash when the user doesn't exist. `auth.test.js` also asserts both cases return the identical 401 body.

### 8. My own test-harness bugs (kept because they taught something)

- **Chaos script keys.** The first version built keys with `Date.now()` per request. Requests meant
  to share a key got different keys whenever the millisecond ticked, so 300 requests in 60 groups
  reported "86 executed". The server was right; the client wasn't generating one key per intent.
  It's the same mistake a real client makes when it mints a new key on every retry.
- **Benchmark data.** The first 1M-row generator put both legs of each transfer on the same
  account, and spread load evenly, so no account was deep enough to show OFFSET's cost. The current
  generator models a hot merchant account (≈167k entries) and a quiet one (40 old entries).

---

## Decisions

### Money is integer minor units, end to end

`amount_minor bigint`, `balance_cached bigint`. The API returns them as strings, because `pg` maps
`int8` to string and JSON numbers lose precision above 2^53. The frontend parses typed amounts with
string arithmetic into `BigInt` and only converts to `Number` for chart pixel positions.
`0.1 + 0.2 !== 0.3` is the whole argument.

### Cached balances, defended by reconciliation

Reads are fast (`balance_cached` on the row), and transfers can check overdraft under the row lock.
The cost is an extra invariant: cache == sum of entries. It is protected three ways:

1. The cache is updated in the **same transaction** as the entries.
2. `wallet_non_negative` is a CHECK constraint, so even a buggy UPDATE can't overdraw.
3. `balance_drift` (a view) and `POST /admin/reconcile` / `scripts/reconcile.js` prove equality.
   CI runs the reconcile job after seeding and fails on any drift.

### Invariants live in the database where possible

See the invariants table in the README. Rule of thumb: if breaking it loses or creates money, the
database enforces it (CHECK, trigger, primary key), and the app checks it too only to return a nice
error. App-only rules are about authorisation (who may move money), because the database doesn't
know who the HTTP caller is.

### Idempotency semantics (compared with Stripe)

| Situation | Ledgerline |
|---|---|
| Same key, same body, after success | Replays the stored 201 body, `Idempotent-Replayed: true` |
| Same key arrives 20 times **in parallel** | The first `INSERT … ON CONFLICT DO NOTHING` takes the unique-index slot; the others block on it until the first commits, then read and replay its stored response. Exactly one transfer (tested). |
| Same key, different body | 422 `IDEMPOTENCY_KEY_REUSED` (request hash differs) |
| Validation failure (400) | Never claims the key: validation runs before the transaction |
| Business failure (insufficient funds, 404, currency mismatch) | The whole transaction rolls back, **including the key claim**, so the key can be retried later |
| Process dies mid-request | Postgres rolls back the open transaction; the key was never committed; a retry runs normally |

The replayed body is semantically identical but not byte-identical: `response_body` is `jsonb`,
which normalises key order. Clients must compare parsed JSON, not raw text.

One difference from Stripe: Stripe stores the first result once execution starts, including
errors. Ledgerline only stores successes, because a failed transfer moved no money and has no side
effects. Retrying it with the same key after topping up is safe and arguably more useful. The
trade-off: a client can't use the key to fetch "what happened last time" for a failure.

**Why no Brandur-style recovery points?** Recovery points matter when a request makes a foreign
call (charge a card, send a payout) **between** local transactions, so the process can die after the
outside world changed but before the database recorded it. A Ledgerline transfer is a single
database transaction with no foreign calls: it either fully commits (key + entries + balances +
stored response + audit) or fully disappears. There is no half-done state to recover. The
`IDEMPOTENCY_IN_PROGRESS` / `locked_at` path is unreachable today and kept as a guard; it becomes
necessary as soon as an external payout step is added. That step would claim and commit the key
first, call the payout API, then record the result in a second transaction.

### Row locks vs SERIALIZABLE

Both are implemented (`TRANSFER_MODE=locks|serializable`). The serializable variant drops
`FOR UPDATE`, runs at `SERIALIZABLE`, and retries `40001`/`40P01` up to 5 times with jittered
backoff. Measured with `scripts/bench-isolation.js` (400 concurrent transfers, pool of 10,
PostgreSQL 18, after migration 003):

| Workload | Mode | Committed | Transfers/s | Retries | Failed after 5 retries | Drift |
|---|---|---|---|---|---|---|
| Low contention (200 accounts) | locks | 398 / 398 | 1,833 | 0 | 0 | 0 |
| Low contention (200 accounts) | serializable | 398 / 398 | 1,362 | 276 | 0 | 0 |
| Hot accounts (4 accounts) | locks | 300 / 300 | 496 | 0 | 0 | 0 |
| Hot accounts (4 accounts) | serializable | 127 / 300 | 320 | 902 | 173 | 0 |

Both modes keep every invariant: no drift, no negative wallet. The difference is cost.

- **Row locks:** contention becomes waiting. Hot accounts serialise, but nothing fails. The price is
  that you must get lock ordering right (bug 4).
- **SERIALIZABLE:** no locking code to get wrong, and it is safe even for reads you forgot to lock.
  But contention becomes aborts, so every caller needs a retry loop, and on hot rows most of the
  work is thrown away. It is also sensitive to how queries are planned (bug 5).

**Choice:** row locks by default. A wallet ledger has hot accounts (merchants, payroll, system
accounts) by nature.

### Read Committed is enough with explicit locks

Under READ COMMITTED each statement sees the latest committed data. Because the balance check
happens after `FOR UPDATE` has locked the sender's row, no other transaction can change that row
until we commit, so check-then-update is safe. The race READ COMMITTED doesn't protect (two
transactions reading the same balance and both debiting) is exactly the one the row lock prevents.

### Keyset pagination on `entries.id`

See `docs/keyset-pagination.md`. `entries.id` is a monotonic identity, so it is already in posting
order. `WHERE account_id = $1 AND id < $cursor ORDER BY id DESC` is a single index range scan on
`(account_id, id)`, at any depth.

### No Redis

Every correctness property here is about atomicity across `idempotency_keys`, `accounts` and
`entries`, and it holds because they commit in one Postgres transaction. Putting idempotency keys
in Redis would split that into two systems with no shared transaction. "Key stored but transfer
rolled back" and "transfer committed but key lost" would both become possible. There is nothing to
cache that is hot enough to need it: balances are already one indexed row read.

### Partitioning `entries` (discussion, not implemented)

At this scale (1M rows, sub-millisecond keyset pages) partitioning would add complexity for no gain.
When it would matter (hundreds of millions of rows):

- **Range by `id`** (or by time via `transfers.created_at`) keeps statement queries
  partition-pruned for recent pages. Old partitions become effectively read-only and can be moved
  to cheaper storage. Detaching is fine because entries are append-only anyway.
- **Hash by `account_id`** spreads write contention, but a statement still needs one partition
  only. Cross-partition reads are just reconciliation.
- **Costs:** the primary key must include the partition key; the deferred balance trigger and the
  `transfer_id` index become per-partition; global uniqueness of `id` relies on the identity
  sequence; and `balance_drift` scans all partitions.
- **Recommendation:** range by id/time first. It matches the access pattern (recent statements)
  and the retention story.
