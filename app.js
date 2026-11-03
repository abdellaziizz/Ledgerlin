import express from "express";
import helmet from "helmet";
import log from "./log.js";
import errorHandler from "./controllers/errorController.js";
import cookieParser from "cookie-parser";
import accountRoutes from "./routes/accountsRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import transferRoutes from "./routes/transferRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import AppError from "./utils/appError.js";
const app = express();
app.use(log);
app.use(cookieParser());
app.use(helmet());
app.use(express.json());

//ROUTES
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/transfer", transferRoutes);
app.use("/api/v1/account", accountRoutes);
app.use("/api/v1/admin", adminRoutes);

app.all("/*splat", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

export default app;
