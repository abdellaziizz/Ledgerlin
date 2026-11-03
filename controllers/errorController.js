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
    console.error(`Unhandled error: ${req.method} ${req.originalUrl}`, err);
  }
  if (process.env.NODE_ENV === "development") {
    res.status(statusCode).json({
      status: error.status,
      message: error.message,
      stack: error.stack,
    });
  } else {
    res.status(statusCode).json({
      status: error.status,
      message: error.isOperational ? error.message : "Something went wrong!",
    });
  }
};

export default errorHandler;
