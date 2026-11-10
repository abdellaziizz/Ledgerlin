import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { promisify } from "util";
import config from "../config.js";
import repo from "../repo.js";
import { audit } from "../services/auditService.js";
import AppError from "../utils/appError.js";

const verifyJwt = promisify(jwt.verify);
const signToken = (user) => jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
const publicUser = ({ id, email, role, created_at }) => ({ id, email, role, created_at });

// Compared against when the email doesn't exist, so a wrong email and a wrong password
// take the same time (no user enumeration through response timing).
const DUMMY_HASH = bcrypt.hashSync("ledgerline-timing-equaliser", 12);

const register = async (req, res) => {
  const { email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await repo.createUser(email, passwordHash); // role defaults to 'customer'
  await audit(null, { actorId: user.id, action: "user.registered", entityType: "user", entityId: user.id });
  res.status(201).json({ status: "success", token: signToken(user), data: { user: publicUser(user) } });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;
  const user = await repo.findUserByEmail(email);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) return next(new AppError("Incorrect email or password", 401, "INVALID_CREDENTIALS"));
  res.status(200).json({ status: "success", token: signToken(user), data: { user: publicUser(user) } });
};

const me = async (req, res) => {
  res.status(200).json({ status: "success", data: { user: publicUser(req.user) } });
};

const protect = async (req, res, next) => {
  let token;
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) token = header.slice(7);
  else if (req.cookies?.jwt) token = req.cookies.jwt;
  if (!token) {
    return next(new AppError("You are not logged in. Please log in to get access.", 401, "UNAUTHENTICATED"));
  }
  const payload = await verifyJwt(token, config.jwtSecret);
  // Re-read the user so a deleted user or changed role takes effect immediately.
  const currentUser = await repo.findUserById(payload.id);
  if (!currentUser) return next(new AppError("User no longer exists", 401, "UNAUTHENTICATED"));
  req.user = currentUser;
  next();
};

const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError("You do not have permission to perform this action", 403, "FORBIDDEN"));
  }
  next();
};

export default { register, login, me, protect, restrictTo };
