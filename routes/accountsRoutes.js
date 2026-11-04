import express from "express";
import authController from "../controllers/authController.js";
import accountController from "../controllers/accountController.js";
import validate from "../validate.js";
import {
  createAccountSchema,
  statementQuerySchema,
  accountParamsSchema,
} from "../schemas/accountSchema.js";
const router = express.Router();
router.use(authController.protect);

router.post(
  "/",
  validate(createAccountSchema),
  accountController.createAccount,
);
router.get(
  "/:id",
  validate(accountParamsSchema),
  accountController.getAccountById,
);
// router.get("/:id/statement?", accountController.getAccountById);

router.get(
  "/:id/statement",
  validate(statementQuerySchema),
  accountController.getStatement,
);
export default router;
