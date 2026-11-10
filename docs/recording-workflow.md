# Recording a demo of Ledgerline

A scene-by-scene script for a 10–12 minute screen recording (portfolio video or interview walkthrough).
Each scene says what to show, the exact commands to run, and the point to make out loud. A
3-minute cut is at the end.

---

## 0. Before you hit record

**Reset to a clean, seeded state**

```bash
docker compose down -v          # wipe the database volume
docker compose up --build -d    # migrate + seed on start
docker compose logs api | head  # shows "applied 001…003" and the demo logins
```

**Screen layout**
- Browser on `http://localhost:8080`, zoom 110–125%, one tab per scene so nothing loads on camera.
- Terminal with a large font (16–18pt), dark theme, prompt shortened (`PS1='$ '`).
- A second terminal with `psql` open:
  `docker compose exec db psql -U ledgerline ledgerline`
- Editor open on `services/transferService.js` and `migration/001_init.sql`.

**Shell helpers** (paste once into the recording terminal)

```bash
API=http://localhost:3000/api/v1
login() { curl -s -X POST $API/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$2\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).token'; }
TOKEN=$(login demo@ledgerline.dev demo-pass-123)
transfer() { curl -s -i -X POST $API/transfers -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -H "Idempotency-Key: $1" -d "$2" | grep -iE '^HTTP|replayed|^\{'; }
```

**Dry-run every scene once**, then reset again with `docker compose down -v && docker compose up -d`.

---

## Scene 1: The problem (≈45 s)

**Show:** README top section.

**Say:** "Ledgerline is a wallet ledger. CRUD apps are about what you *can* do. A ledger is about
what must *never* happen: money created or destroyed, a retried request charged twice, two
concurrent transfers corrupting a balance. Each of those is enforced by PostgreSQL and proven by a
test."

## Scene 2: Architecture in one picture (≈1 min)

**Show:** the README architecture diagram, then the sequence diagram.

**Say:** "One request is one database transaction. It claims the idempotency key, locks both
accounts in id order, checks the balance, writes a debit and a credit, updates the cached balances,
stores the response, and commits. If anything fails, all of it rolls back, including the key."

Optionally flip to `services/transferService.js` and scroll through steps 0–5 in the comments.

## Scene 3: The product (≈2 min)

**Show:** browser.

1. Sign in as `demo@ledgerline.dev` / `demo-pass-123`.
2. **Overview:** "Totals are per currency and never converted; system accounts are excluded."
3. **Accounts → #3:** the balance chart. "This line is reconstructed exactly from the live balance
   and the entries; there's no float arithmetic anywhere in the money path."
4. **Statements:** page size 10, click **Load older entries** until **Opening balance 0.00** with
   the double rule. "Keyset pagination: each page is an index range scan, however deep."
5. **Transfers:** send `75.50` EGP from #3 to account number `6` (Omar).
   On the review dialog, point at the **Request key**: "The key is created per intent, before
   sending." **Double-click** *Confirm and send*.
6. Receipt. Then in psql:
   ```sql
   SELECT id, description, created_at FROM transfers ORDER BY id DESC LIMIT 3;
   ```
   "A double-click sent one request, and exactly one new transfer exists."

## Scene 4: Idempotency from the outside (≈1.5 min)

**Show:** terminal.

```bash
BODY='{"from_account_id":3,"to_account_id":4,"amount_minor":1000,"currency":"EGP"}'
transfer demo-key-1 "$BODY"        # 201
transfer demo-key-1 "$BODY"        # 201 + Idempotent-Replayed: true, same transfer id
transfer demo-key-1 '{"from_account_id":3,"to_account_id":4,"amount_minor":9999,"currency":"EGP"}'   # 422 IDEMPOTENCY_KEY_REUSED
transfer demo-key-2 '{"from_account_id":3,"to_account_id":4,"amount_minor":10.5,"currency":"EGP"}'  # 400, floats rejected
```

**Say:** "Same key and same body replays the stored response. Same key with a different body is a
client error. And what if the process dies mid-request? Then the transaction never committed, so
the key was never claimed, and the retry just runs. That's why I don't need Brandur-style recovery
points: there's no external call between transactions."

## Scene 5: Concurrency and the chaos test (≈1.5 min)

```bash
API_URL=http://localhost:3000 npm run chaos
```

**Show:** the two tables: 60 executed, 240 replayed, and four PASS checks.

**Say:** "300 concurrent requests, five per key, in both directions between two wallets, for more
money than exists. Nothing goes negative, money is conserved, every key moves money once, and the
ledger reconciles."

Then open `tests/integration/concurrency.test.js` → "reproduces the deadlock that lock ordering
prevents": "Two transactions locking A→B and B→A deadlock; Postgres kills one with 40P01. Locking
in id order makes them queue instead."

## Scene 6: The database is the last line of defence (≈1 min)

**Show:** psql.

```sql
UPDATE entries SET amount_minor = 1 WHERE id = 1;            -- ERROR: entries is append-only
DELETE FROM entries WHERE id = 1;                             -- ERROR
UPDATE accounts SET balance_cached = -1 WHERE id = 3;         -- ERROR: violates wallet_non_negative
BEGIN;
  WITH t AS (INSERT INTO transfers (description) VALUES ('forged') RETURNING id)
  INSERT INTO entries (transfer_id, account_id, amount_minor, direction)
  SELECT id, 3, 500, 'credit' FROM t;                         -- succeeds... for now
COMMIT;                                                       -- ERROR at COMMIT: deferred trigger
```

**Say:** "Even with raw SQL and no application at all, the database refuses. The balance trigger is
deferred, so it checks at COMMIT, after both legs exist."

## Scene 7: Auditor and reconciliation (≈1 min)

1. psql, simulating a bug that touches the cache without entries:
   ```sql
   UPDATE accounts SET balance_cached = balance_cached + 999 WHERE id = 3;
   ```
2. Browser: sign out, sign in as `auditor@ledgerline.dev` / `audit-pass-123`. Go to
   **Reconciliation → Run**: *Drift detected*, account #3, difference +9.99.
3. Undo it and run again (*Ledger reconciled*):
   ```sql
   UPDATE accounts SET balance_cached = balance_cached - 999 WHERE id = 3;
   ```

**Say:** "Cached balances are fast but they're an extra invariant. Reconciliation proves cache
equals the sum of entries. CI runs it after seeding, and every run is written to the append-only
audit log."

## Scene 8: Tests and CI (≈1 min)

```bash
npm test
```

**Show:** the 56 passing tests (≈35 s; Testcontainers starts a real PostgreSQL 18). Then the
GitHub Actions run: backend tests, migrations from an empty database, frontend, and Docker build.

## Scene 9: Two engineering findings (≈1.5 min)

1. **Keyset benchmark:** `docs/keyset-pagination.md` table. "OFFSET 100,000 takes 130 ms and spills
   to disk; keyset takes 0.12 ms. For a quiet account, the composite index takes the first page
   from 36 ms to 0.08 ms."
2. **SERIALIZABLE false positives:** `docs/design-notes.md` bug 5. "Under SERIALIZABLE, transfers on
   completely unrelated accounts were failing. The deferred trigger's join made Postgres
   sequentially scan `accounts`, which predicate-locks the whole table. Migration 003 looks
   accounts up by primary key, and the failures went from 127 to 0. Even so, on hot accounts row
   locks still win, so they're the default."

## Scene 10: Close (≈20 s)

**Say:** "Integer minor units, one transaction per transfer, invariants in the database, and
tests that attack each one. The design notes list the bugs I hit and how each was fixed."

---

## The 3-minute cut

1. Scene 1, one sentence (10 s)
2. Scene 3, steps 5–6: double-click transfer, one row in the database (50 s)
3. Scene 4: the first three curl commands (40 s)
4. Scene 5: `npm run chaos` (30 s)
5. Scene 6: the `UPDATE entries` and negative-balance errors (25 s)
6. Scene 8: `npm test` summary line (15 s)

## Recording tips

- Record at 1920×1080. Hide notifications; close unrelated tabs.
- Rehearse with the exact commands above; typos on camera waste more time than slow speech.
- If a command output is long, scroll to the line you're talking about and pause on it.
- Re-seed between takes: `docker compose down -v && docker compose up -d`.
- Keep each scene a separate clip; it is much easier to re-record one scene than the whole video.
