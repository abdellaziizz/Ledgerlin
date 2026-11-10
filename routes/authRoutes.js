import express from "express";
import authController from "../controllers/authController.js";
import { loginSchema, registerSchema } from "../schemas/authSchema.js";
import validate from "../validate.js";

const router = express.Router();
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.get("/me", authController.protect, authController.me);

export default router;
