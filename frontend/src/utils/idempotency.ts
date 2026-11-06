/**
 * Idempotency-Key generation for POST /transfer.
 * One key per *intent*: the same key is reused when retrying an attempt whose outcome
 * is unknown (network failure, 5xx, 409 in progress), and a fresh key is minted when
 * the transfer details change. The backend replays the stored 201 for a reused key.
 */
export function newIdempotencyKey(): string {
  // randomUUID only exists in secure contexts (https/localhost); getRandomValues works everywhere.
  if (typeof crypto.randomUUID === "function") return `tr_${crypto.randomUUID()}`;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `tr_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
