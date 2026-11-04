import express from "express";
import authController from "../controllers/authController.js";
import adminController from "../controllers/adminController.js";
const router = express.Router();
router.post(
  "/reconcile",
  authController.protect,
  authController.restrictTo("auditor"),
  adminController.reconcile,
);
export default router;
