import { logger } from "../config/logger.js";

export function notFound(req, res) {
  res.status(404).json({ code: "NOT_FOUND", message: "Route not found", requestId: req.id });
}

export function errorHandler(err, req, res, _next) {
  const status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const log = status >= 500 ? logger.error.bind(logger) : logger.warn.bind(logger);
  log({ err, requestId: req.id, status }, "request failed");

  const payload = {
    code: err.code || (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR"),
    message: status >= 500 ? "Internal server error" : err.message,
    requestId: req.id
  };

  if (status === 400 && Array.isArray(err.issues)) {
    payload.issues = err.issues.map((issue) => ({ path: issue.path?.join("."), message: issue.message }));
  }

  res.status(status).json(payload);
}
