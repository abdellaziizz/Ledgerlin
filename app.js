import cookieParser from "cookie-parser";
import express from "express";
import fs from "fs";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import errorHandler from "./controllers/errorController.js";
import { pool } from "./db.js";
import { httpLogger } from "./log.js";
import accountRoutes from "./routes/accountsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";
import AppError from "./utils/appError.js";

const openapi = YAML.parse(fs.readFileSync(new URL("./openapi.yaml", import.meta.url), "utf8"));

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback, linklocal, uniquelocal"); // behind the web container / Vite proxy
app.use(httpLogger);
app.use(helmet());
app.use(cookieParser());
app.use(express.json({ limit: "16kb" }));

// Liveness + database readiness.
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "ok" });
  } catch {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

// API docs: Swagger UI at /docs, raw spec at /openapi.json.
app.get("/openapi.json", (_req, res) => res.json(openapi));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "Ledgerline API" }));

// ROUTES (plural resource names, as in the API spec)
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/accounts", accountRoutes);
app.use("/api/v1/transfers", transferRoutes);
app.use("/api/v1/admin", adminRoutes);

app.all("/*splat", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404, "NOT_FOUND"));
});

app.use(errorHandler);

export default app;
