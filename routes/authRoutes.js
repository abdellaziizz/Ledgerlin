import express from "express";
import authController from "../controllers/authController.js";
import validate from "../validate.js";
import { registerSchema, loginSchema } from "../schemas/authSchema.js";

const router = express.Router();
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
export default router;
