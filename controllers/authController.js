import repo from "./../repo.js";
import jwt from "jsonwebtoken";
import AppError from "../utils/appError.js";
import bycrypt from "bcryptjs";
import util, { promisify } from "util";
import catchAsync from "../utils/catchAsync.js";
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};
const login = async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(
      new AppError("Please provide email and password", 400, "Auth Error"),
    );
  }
  const user = await repo.findUserByEmail(email);
  if (!user || !(await bycrypt.compare(password, user.password_hash))) {
    return next(new AppError("Incorrect email or password", 401, "Auth Error"));
  }
  return res.status(200).json({
    status: "success",
    token: signToken(user.id),
  });
};
const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token) {
    return next(
      new AppError(
        "You are not logged in. Please log in to get access.",
        401,
        "Auth Error",
      ),
    );
  }
  const verify = await util.promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET,
  );
  const currentUser = await repo.findUserById(verify.id);
  if (!currentUser) {
    return next(new AppError("User no longer exists", 401, "UNAUTHENTICATED"));
  }
  req.user = currentUser;
  next();
};
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403,
          "Auth Error",
        ),
      );
    }
    next();
  };
};
const register = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  const passwordHash = await bycrypt.hash(password, 12);
  const user = await repo.createUser(email, passwordHash);
  return res.status(201).json({
    status: "success",
    token: signToken(user.id),
  });
});
export default { login, protect, restrictTo, register };
