import express from "express";
import accountController from "../controllers/accountController.js";
import authController from "../controllers/authController.js";
import ownerController from "../controllers/ownerController.js";
import { accountParamsSchema, createAccountSchema, statementQuerySchema } from "../schemas/accountSchema.js";
import validate from "../validate.js";

const router = express.Router();
router.use(authController.protect);

router.get("/", accountController.listAccounts);
router.post("/", validate(createAccountSchema), accountController.createAccount);
router.get("/:id", validate(accountParamsSchema), ownerController.loadAccount, accountController.getAccountById);
router.get("/:id/statement", validate(statementQuerySchema), ownerController.loadAccount, accountController.getStatement);

export default router;
