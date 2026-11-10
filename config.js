import dotenv from "dotenv";

// Local development reads config.env (git-ignored). In Docker/CI the variables come
// from the environment and dotenv never overrides them.
dotenv.config({ path: process.env.ENV_FILE || "./config.env", quiet: true });

const required = ["JWT_SECRET"];
for (const key of required) {
  if (!process.env[key] && process.env.NODE_ENV !== "test") {
    throw new Error(`Missing required environment variable ${key}`);
  }
}

export default {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || "127.0.0.1",
  jwtSecret: process.env.JWT_SECRET,
  // Short-lived access tokens; there is no refresh token, so the client signs in again.
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  // "locks" (default): SELECT ... FOR UPDATE in id order under READ COMMITTED.
  // "serializable": no explicit locks, SERIALIZABLE isolation with retry on 40001/40P01.
  transferMode: process.env.TRANSFER_MODE === "serializable" ? "serializable" : "locks",
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info"),
};
