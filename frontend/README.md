# Ledgerline — web frontend

React + TypeScript + Vite client for the Ledgerline API. It talks to the existing Express backend as-is; nothing in the backend was changed for it.

## Run

```bash
# 1. Backend (from the repository root), listening on 127.0.0.1:$PORT (3000 by default)
node server.js

# 2. Frontend
cd frontend
cp .env.example .env.local   # optional; defaults work for a backend on 127.0.0.1:3000
npm install
npm run dev                  # http://localhost:5173
```

`npm run build` type-checks and builds to `dist/`. `npm run preview` serves the build with the same `/api` proxy.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | Base path the browser uses for API calls. |
| `VITE_API_PROXY_TARGET` | `http://127.0.0.1:3000` | Where the Vite dev/preview server forwards `/api`. |

The backend sends no CORS headers, so the browser calls the frontend's own origin and Vite proxies `/api` to Express. In production, serve `dist/` and the API behind one origin (a reverse proxy), or add CORS to the backend.

## Structure

```
src/
  config/          env access
  services/api/    the only place that calls fetch(): client, errors, auth, accounts, transfers, admin
  services/auth/   token session (sessionStorage) and JWT expiry decoding
  services/accountRegistry.ts   per-user list of account ids (see "Known gaps")
  contexts/        Auth and Theme providers
  hooks/           TanStack Query hooks and derived account overviews
  utils/           money (BigInt minor units), ledger derivations, formatting, idempotency keys
  components/      ui primitives, layout, accounts, statement, transfers
  pages/           auth, dashboard, accounts, transfers, statements, settings, audit
  routes/          router and route guards
```

## Money

Amounts stay in integer minor units end to end: API strings become `BigInt`, user input is parsed with string arithmetic (`utils/money.ts`), and display uses `Intl.NumberFormat` on exact decimal strings. Precision follows the currency (EGP 2, JPY 0, KWD 3). Chart geometry is the only place values become `Number`.

## Transfers and idempotency

Each transfer intent gets an `Idempotency-Key` when the review dialog opens. If the outcome is unknown (network error, 5xx, `IDEMPOTENCY_IN_PROGRESS`), "Retry safely" resends with the **same** key, so the backend replays the original result instead of moving money twice. Definite rejections (insufficient funds, currency mismatch, not found) return to the form; changing any detail mints a new key. The confirm button locks while a request is in flight, and mutations are never auto-retried.

## Known gaps (backend not available yet)

Search for `TODO: Not implemented yet` in `src/`.

- **No "list my accounts" endpoint.** The app remembers account ids opened or added on this device (`services/accountRegistry.ts`); every figure is fetched live, and ownership is enforced by the backend.
- **`GET /account/:id` returns 500** (its SQL references a missing `role` column). Balances come from the statement endpoint; type and open date are known only for accounts opened in this browser, or inferred as "system" from a negative balance.
- **`POST /admin/reconcile` is unfinished**, and the route currently stops `app.js` from loading. The Reconciliation page is a placeholder.
- **No `/me`, logout, password change/reset, transfer history/detail, account locking/status, or statement filters.** Sign-out only discards the token locally. Transfer history is assembled from statements. Direction filtering applies to loaded entries.
