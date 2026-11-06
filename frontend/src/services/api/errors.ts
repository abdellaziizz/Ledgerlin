import type { ApiErrorBody } from "@/types/api";

export type ApiErrorKind = "http" | "network" | "aborted";

/**
 * Normalised error for every API call. `code` is the backend's error code
 * (e.g. INSUFFICIENT_FUNDS, IDEMPOTENCY_KEY_REUSED, VALIDATION_ERROR); note that some
 * backend codes are free text ("Auth Error"), so callers should branch on status first.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code: string | undefined;
  /** Parsed from VALIDATION_ERROR messages of the form "field: message; other: message". */
  readonly fieldErrors: Record<string, string>;

  constructor(opts: { kind: ApiErrorKind; status?: number; code?: string; message: string; fieldErrors?: Record<string, string> }) {
    super(opts.message);
    this.name = "ApiError";
    this.kind = opts.kind;
    this.status = opts.status ?? 0;
    this.code = opts.code;
    this.fieldErrors = opts.fieldErrors ?? {};
  }

  get isNetwork() {
    return this.kind === "network";
  }
}

export function parseFieldErrors(message: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of message.split("; ")) {
    const i = part.indexOf(": ");
    if (i > 0) out[part.slice(0, i)] = part.slice(i + 2);
  }
  return out;
}

const FRIENDLY: Record<string, string> = {
  INSUFFICIENT_FUNDS: "This account doesn't have enough funds for the transfer.",
  CURRENCY_MISMATCH: "Both accounts must hold the same currency as the transfer.",
  ACCOUNT_NOT_FOUND: "That account doesn't exist or you don't have access to it.",
  SAME_ACCOUNT: "Choose two different accounts.",
  IDEMPOTENCY_KEY_REUSED: "This transfer request was already used with different details. Review and submit again.",
  IDEMPOTENCY_IN_PROGRESS: "This transfer is still being processed. Wait a moment, then retry — it won't be sent twice.",
  RETRY: "The ledger was busy. Retry — it won't be sent twice.",
  TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  TOKEN_INVALID: "Your session is no longer valid. Please sign in again.",
  UNAUTHENTICATED: "Your session is no longer valid. Please sign in again.",
  CONFLICT: "That already exists.",
  CONSTRAINT_VIOLATION: "The ledger rejected this request because it would break a balance rule.",
  BAD_REFERENCE: "A referenced record doesn't exist.",
  INVALID_INPUT: "Some of the values aren't valid.",
};

export function errorFromResponse(status: number, body: Partial<ApiErrorBody> | null): ApiError {
  const code = body?.code;
  const raw = typeof body?.message === "string" ? body.message : undefined;
  const fieldErrors = code === "VALIDATION_ERROR" && raw ? parseFieldErrors(raw) : {};
  let message = (code && FRIENDLY[code]) || raw;
  if (!message || status >= 500) {
    message = status >= 500 ? "The server ran into a problem. Please try again." : `Request failed (${status}).`;
  }
  return new ApiError({ kind: "http", status, code, message, fieldErrors });
}

/** Human message for any thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
