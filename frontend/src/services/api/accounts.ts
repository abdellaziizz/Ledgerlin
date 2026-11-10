import type { Account, Envelope, Statement } from "@/types/api";
import { request } from "./client";

/** GET /accounts -> the caller's accounts (every account for auditors). */
export async function listAccounts(signal?: AbortSignal): Promise<Account[]> {
  const res = await request<Envelope<Account[]>>("/accounts", { signal });
  return res.body.data;
}

/** POST /accounts { currency } -> 201 Account. Customers can only open wallets. */
export async function createAccount(currency: string): Promise<Account> {
  const res = await request<Envelope<Account>>("/accounts", { method: "POST", body: { currency } });
  return res.body.data;
}

/** GET /accounts/:id -> Account, or 404 ACCOUNT_NOT_FOUND (not yours, or doesn't exist). */
export async function getAccount(id: string, signal?: AbortSignal): Promise<Account> {
  const res = await request<Envelope<Account>>(`/accounts/${encodeURIComponent(id)}`, { signal });
  return res.body.data;
}

/**
 * GET /accounts/:id/statement?cursor=&limit= -> Statement (newest first).
 * Keyset pagination: pass `next_cursor` from the previous page as `cursor`. limit 1..100 (default 50).
 */
export async function getStatement(
  id: string,
  { cursor, limit }: { cursor?: string | null; limit?: number } = {},
  signal?: AbortSignal,
): Promise<Statement> {
  const res = await request<Envelope<Statement>>(`/accounts/${encodeURIComponent(id)}/statement`, {
    query: { cursor, limit },
    signal,
  });
  return res.body.data;
}

// TODO: Not implemented yet - account locking/unlocking and account status are not in the
// backend schema or routes.
