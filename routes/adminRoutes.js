import express from "express";
import authController from "../controllers/authController.js";
import adminController from "../controllers/adminController.js";
const router = express.Router();
router.post(
  "/reconcile",
  authenticate,
  requireRole("auditor"),
  admin.reconcile,
);
export default router;
