import express from "express";
import adminController from "../controllers/adminController.js";
import authController from "../controllers/authController.js";
import { reconcileSchema } from "../schemas/adminSchema.js";
import validate from "../validate.js";

const router = express.Router();
router.use(authController.protect, authController.restrictTo("auditor"));
router.post("/reconcile", validate(reconcileSchema), adminController.reconcile);

export default router;
