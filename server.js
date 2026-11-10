import config from "./config.js";
import app from "./app.js";
import { pool } from "./db.js";
import { logger } from "./log.js";

const server = app.listen(config.port, config.host, () => {
  logger.info({ host: config.host, port: config.port, transferMode: config.transferMode }, "Ledgerline API listening");
});

const shutdown = (signal, code = 0) => {
  logger.info({ signal }, "shutting down");
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(code);
  });
  setTimeout(() => process.exit(code), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "unhandledRejection");
  shutdown("unhandledRejection", 1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaughtException");
  shutdown("uncaughtException", 1);
});
