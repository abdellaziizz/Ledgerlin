import crypto from "crypto";
import pino from "pino";
import pinoHttp from "pino-http";
import config from "./config.js";

export const logger = pino({
  level: config.logLevel,
  redact: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']"],
});

// Structured JSON request logs. Every request gets an id (client-supplied X-Request-Id
// if it looks sane, otherwise a UUID) that is echoed back and attached to every log line.
export const httpLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const incoming = req.headers["x-request-id"];
    const id = typeof incoming === "string" && /^[\w.-]{1,128}$/.test(incoming) ? incoming : crypto.randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
