# Ledgerline — web frontend

React + TypeScript + Vite client for the Ledgerline API. In Docker it's the `web` service on http://localhost:8080 (see the root README).

## Run

```bash
# 1. Backend (from the repository root), listening on 127.0.0.1:$PORT (3000 by default)
npm run db:migrate && npm run db:seed && npm run dev

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

The API is served from the same origin as the app: Vite proxies `/api` in development, and in Docker the `web` container's nginx (`nginx.conf`) serves `dist/` and proxies `/api`, `/docs` and `/health` to the API. No CORS is needed.

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

## Backend integration

All data comes from the Ledgerline API (`/api/v1`): `auth/register|login|me`, `accounts` (list, create,
detail, keyset statement), `transfers` (with `Idempotency-Key`) and `admin/reconcile` (auditors).
The role shown in the UI comes from `/auth/me`; the backend authorises every request regardless.

Remaining TODOs (search `TODO: Not implemented yet` in `src/`) are features the API doesn't offer:
password change/reset, profile editing, account status/locking, server-side statement filters, and a
transfer-detail view with the counterparty.

## Tests

`npm test` runs Vitest on the money and ledger maths (`src/utils/__tests__`): exact decimal parsing,
currency precision, formatting of very large values, and running-balance reconstruction.
