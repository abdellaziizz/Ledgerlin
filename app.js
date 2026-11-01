import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import errorHandler from "./controllers/errorController.js";
import cookieParser from "cookie-parser";
import Router from "./routes/Router.js";
const app = express();
app.use(cookieParser());
app.use(helmet());
app.use(express.json());
if (process.env.NODE_ENV === "development") app.use(morgan("dev"));

//ROUTES
app.use("/api/v1", Router);

app.all("/*splat", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

export default app;
