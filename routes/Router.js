import express from "express";
import authController from "../controllers/authController.js";
import accountController from "../controllers/accountController.js";
const router = express.Router();
router.get("/account/:id");
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.use(authController.protect);
router.get(
  "/account/:id",
  authController.restrictTo("customer"),
  accountController.getAccount,
);
router.post(
  "/account",
  authController.restrictTo("customer"),
  accountController.createAccount,
);
router.post(
  "/account/:id",
  authController.restrictTo("customer"),
  accountController.transferFunds,
);
export default router;
