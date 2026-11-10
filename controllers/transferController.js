import { hashRequest } from "../middleware/idempotencyKey.js";
import { createTransfer as runTransfer } from "../services/transferService.js";

// Validation (transferSchema) and the Idempotency-Key header check run before this handler,
// so invalid requests never claim a key — matching Stripe's "validation failures aren't saved".
const createTransfer = async (req, res) => {
  const result = await runTransfer({
    userId: req.user.id,
    idempotencyKey: req.idempotencyKey,
    requestHash: hashRequest(req),
    input: req.body,
  });
  if (result.replayed) res.set("Idempotent-Replayed", "true");
  res.status(result.code).json(result.body);
};

export default { createTransfer };
