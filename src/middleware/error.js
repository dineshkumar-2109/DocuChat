import { config } from "../config/index.js";

// 404 handler
export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

// Central error handler. Express recognizes it by its 4 args.
export function errorHandler(err, req, res, next) {
  // eslint-disable-line no-unused-vars
  // Multer errors (e.g. file too large) are client errors, not 500s.
  if (err.name === "MulterError") {
    err.status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    err.expose = true;
  }

  const status = err.status || 500;

  // Only server faults are worth a stack trace; 4xx are expected traffic.
  if (status >= 500) console.error(err);
  const body = { error: err.expose ? err.message : "Internal server error" };

  if (config.env !== "production") {
    body.message = err.message;
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

// Helper to throw HTTP errors with a status and user-safe message.
export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}
