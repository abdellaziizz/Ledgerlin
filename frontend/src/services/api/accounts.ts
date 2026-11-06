import type { Account, Envelope, Statement } from "@/types/api";
import { request } from "./client";

/**
 * POST /account { currency, kind? } -> 201 Account.
 * The UI only ever opens "wallet" accounts. The backend schema also accepts kind "system"
 * (accounts allowed to go negative); exposing that to customers would let them mint money,
 * so it is deliberately not offered here.
 */
export async function createAccount(currency: string): Promise<Account> {
  const res = await request<Envelope<Account>>("/account", { method: "POST", body: { currency, kind: "wallet" } });
  return res.body.data;
}

/**
 * GET /account/:id -> 200 Account, or 404 ACCOUNT_NOT_FOUND.
 * TODO: Backend bug - the controller's query references a `role` column that does not exist
 * on `accounts`, so this currently returns 500 for every id. Callers treat it as optional
 * metadata and fall back to the statement endpoint, which works and is ownership-checked.
 */
export async function getAccount(id: string, signal?: AbortSignal): Promise<Account> {
  const res = await request<Envelope<Account>>(`/account/${encodeURIComponent(id)}`, { signal });
  return res.body.data;
}

/**
 * GET /account/:id/statement?cursor=&limit= -> 200 Statement (newest first).
 * Keyset pagination: pass `next_cursor` from the previous page as `cursor`. limit 1..100 (default 50).
 * Customers get 404 for accounts they don't own.
 */
export async function getStatement(
  id: string,
  { cursor, limit }: { cursor?: string | null; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Statement> {
  const res = await request<Envelope<Statement>>(`/account/${encodeURIComponent(id)}/statement`, {
    query: { cursor, limit },
    signal,
  });
  return res.body.data;
}

// TODO: Not implemented yet - the backend has no endpoint to list the signed-in user's accounts
// (e.g. GET /account). The frontend keeps a per-user list of account ids opened or added on this
// device (see services/accountRegistry.ts) and loads every figure from the backend.
// TODO: Not implemented yet - account locking/unlocking and account status are not in the
// backend schema or routes.
