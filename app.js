import express from "express";
import helmet from "helmet";
import log from "./log.js";
import errorHandler from "./controllers/errorController.js";
import cookieParser from "cookie-parser";
import Router from "./routes/Router.js";
const app = express();
app.use(log);
app.use(cookieParser());
app.use(helmet());
app.use(express.json());

//ROUTES
app.use("/api/v1", Router);

app.all("/*splat", (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(errorHandler);

export default app;
