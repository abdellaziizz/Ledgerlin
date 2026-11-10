/*
 * Types mirror the backend responses exactly (verified against the running controllers).
 * Postgres bigint columns (ids, money) arrive as strings; keep them as strings.
 */

export type Role = "customer" | "auditor";
export type AccountKind = "wallet" | "system";
export type Direction = "debit" | "credit";

/** Error body from controllers/errorController.js. `stack` is present only in development and is never shown. */
export interface ApiErrorBody {
  status: "fail" | "error";
  code?: string;
  message?: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  created_at: string;
}

/** POST /auth/register (201) and POST /auth/login (200). */
export interface AuthResponse {
  status: "success";
  token: string;
  data: { user: User };
}

/** POST /admin/reconcile (auditor only). */
export interface ReconcileResult {
  reconciled: boolean;
  accounts_checked: number;
  drifted_accounts: { account_id: string; balance_cached: string; balance_derived: string; difference: string }[];
  unbalanced_transfers: string[];
  checked_at: string;
}

/** GET /accounts, POST /accounts (201), GET /accounts/:id. */
export interface Account {
  id: string;
  owner_id: string;
  currency: string;
  kind: AccountKind;
  balance_cached: string;
  created_at: string;
}

/** The account header returned with a statement. */
export interface StatementAccount {
  id: string;
  currency: string;
  balance_cached: string;
}

export interface StatementEntry {
  id: string;
  transfer_id: string;
  direction: Direction;
  amount_minor: string;
  signed_amount_minor: string;
  description: string | null;
  /** The transfer's created_at. */
  created_at: string;
}

/** GET /accounts/:id/statement?cursor=&limit= (keyset, newest first). */
export interface Statement {
  account: StatementAccount;
  entries: StatementEntry[];
  next_cursor: string | null;
}

/** POST /transfers body. Ids and amount must be JSON numbers (z.number().int()). */
export interface CreateTransferInput {
  from_account_id: number;
  to_account_id: number;
  amount_minor: number;
  currency: string;
  description?: string;
}

export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount_minor: string;
  currency: string;
  description: string | null;
  created_at: string;
}

export interface Envelope<T> {
  status: "success";
  data: T;
}
