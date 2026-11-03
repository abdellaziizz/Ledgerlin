import crypto from "crypto";
import AppError from "../utils/appError.js";

// Only checks the header is present and well formed. Claiming the key
// (INSERT INTO idempotency_keys) must happen inside the transfer transaction.

const requireIdempotencyKey = (req, res, next) => {
  const key = req.get("Idempotency-Key")?.trim();
  if (!key) {
    return next(
      new AppError(
        "Idempotency-Key header is required",
        400,
        "IDEMPOTENCY_KEY_MISSING",
      ),
    );
  }
  if (key.length > 255) {
    return next(
      new AppError(
        "Idempotency-Key must be at most 255 characters",
        400,
        "IDEMPOTENCY_KEY_INVALID",
      ),
    );
  }
  req.idempotencyKey = key;
  next();
};
// Fingerprint stored in idempotency_keys.request_hash. Call it after validate()
// so the body is the parsed one (fixed key order), making retries hash identically.
const hashRequest = (req) =>
  crypto
    .createHash("sha256")
    .update(
      `${req.method} ${req.baseUrl}${req.path} ${JSON.stringify(req.body)}`,
    )
    .digest("hex");

export { requireIdempotencyKey, hashRequest };
