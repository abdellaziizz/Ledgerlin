import type { CreateTransferInput, Envelope, Transfer } from "@/types/api";
import { request } from "./client";

export interface TransferResult {
  transfer: Transfer;
  /** True when the backend replayed a stored response for this Idempotency-Key. */
  replayed: boolean;
}

/**
 * POST /transfer with the Idempotency-Key header.
 * 201 Transfer (header Idempotent-Replayed: true on replay).
 * Errors: 400 VALIDATION_ERROR / CURRENCY_MISMATCH / IDEMPOTENCY_KEY_MISSING, 404 ACCOUNT_NOT_FOUND,
 * 409 IDEMPOTENCY_IN_PROGRESS, 422 INSUFFICIENT_FUNDS / IDEMPOTENCY_KEY_REUSED, 503 RETRY.
 */
export async function createTransfer(input: CreateTransferInput, idempotencyKey: string): Promise<TransferResult> {
  const res = await request<Envelope<Transfer>>("/transfer", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return { transfer: res.body.data, replayed: res.headers.get("Idempotent-Replayed") === "true" };
}

// TODO: Not implemented yet - no transfer history or transfer detail endpoint
// (e.g. GET /transfer, GET /transfer/:id). History is assembled from account statements.
