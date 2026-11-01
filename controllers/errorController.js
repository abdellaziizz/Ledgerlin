// import AppError from "./../utils/appError.js";
// const handleInvalidJWT = (err) => {
//   const message = "Invalid token. Please login Again";
//   return new AppError(message, 401);
// };
// const handleValidationErrorDB = (err) => {
//   const errors = Object.values(err).map((el) => {
//     el.message;
//   });
//   const message = `$Invalid input data. ${errors.join(". ")}`;
//   return new AppError(message, 400);
// };
// const handleExpiredJwt = () => {
//   return new AppError("Expired token , please login again", 401);
// };
// const sendErrorToDev = (err, req, res) => {
//   if (req.originalUrl.startWith("/api")) {
//     res
//       .status(err.statusCode)
//       .json({ status: err.status, message: err.message, stack: err.stack });
//   } else {
//     res
//       .status(err.statusCode)
//       .render("error", { title: "Something went wrong", msg: err.message });
//   }
// };
// const sendErrorToProd = (req, res, err) => {
//   if (req.originalUrl.startsWith("/api")) {
//     res
//       .status(err.statusCode)
//       .json({ status: err.status, message: err.message, stack: err.stack });
//   } else {
//     res
//       .status(err.statusCode)
//       .render("error", { title: "Something went wrong", msg: err.message });
//   }
// };
// export default (req, res, next, err) => {
//   if (process.env.NODE_ENV === "development") {
//     sendErrorToDev(err, req, res);
//   } else {
//     let error = { ...err };
//     if (error.name === "JsonWebTokenError") error = handleInvalidJWT(err);
//     if (error.name === "TokenExpiredError") error = handleExpiredJwt();
//     if (error.name === "ValidationError") error = handleValidationErrorDB(err);
//     sendErrorToProd(req, res, error);
//   }
//   err.status = err.status || "error";
//   err.statusCode = err.statusCode || 500;
//   res.status(err.statusCode).json({ status: err.status, message: err.message });
// };
import AppError from "./../utils/appError.js";
const fromPgError = (err) => {
  switch (err.code) {
    case "23505":
      return new AppError("Resource already exists", 409, "CONFLICT");
    case "23514":
      return new AppError(
        "Request violates a rule",
        422,
        "CONSTRAINT_VIOLATION",
      );
    case "23503":
      return new AppError("Related resource not found", 422, "BAD_REFERENCE");
    case "40P01":
    case "40001":
      return new AppError("Please retry the request", 503, "RETRY");
  }
  return err;
};
const errorHandler = (err, req, res, next) => {
  const error = err.code ? fromPgError(err) : err;
  const statusCode = error.statusCode || 500;
  if (!error.isOperational) {
    logger.error({ err, path: req.originalUrl }, "Unhandled error");
  }
  if (process.env.NODE_ENV === "development") {
    res.status(statusCode).json({
      status: error.status,
      message: error.message,
      stack: error.stack,
    });
  }
  if (process.env.NODE_ENV === "production") {
    res.status(statusCode).json({
      status: error.status,
      message: error.isOperational ? error.message : "Something went wrong!",
    });
  }
};

export default errorHandler;
