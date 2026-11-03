import express from "express";
import authController from "../controllers/authController.js";
import accountController from "../controllers/accountController.js";
import validate from "../validate.js";
import {
  createAccountSchema,
  statementQuerySchema,
} from "../schemas/accountSchema.js";

const router = express.Router();
router.use(authController.protect);
router.get("/:id", accountController.getAccountById);
// router.get("/:id/statement?", accountController.getAccountById);

router.post("/", accountController.createAccounts);

router.get(
  "/:id/statement",
  requireAccountAccess,
  validate(statementQuerySchema, "query"),
  accountController.statement,
);
export default router;
