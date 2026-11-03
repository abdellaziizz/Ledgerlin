import express from "express";
import authController from "../controllers/authController.js";
import validate from "../validate.js";
import { requireIdempotencyKey } from "../middleware/idempotencyKey.js";
import transferController from "../controllers/transferController.js";
import { transferSchema } from "../schemas/transferSchema.js";
const router = express.Router();
router.post(
  "/",
  authController.protect,
  requireIdempotencyKey,
  validate(transferSchema),
  transferController.createTransfer,
);
export default router;
