import { env } from "../config/env.js";

export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    code: "ROUTE_NOT_FOUND",
  });
};

// Every error response has the same shape:
// { success: false, message, code }
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let code = err.code || "INTERNAL_ERROR";

  // Mongoose validation errors -> 400 with the first field's message
  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = Object.values(err.errors)[0]?.message || message;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_KEY";
    const field = Object.keys(err.keyPattern || {})[0];
    message = field ? `${field} already in use` : "Duplicate value";
  }

  // Always log server errors (so they show up in Render/host logs); client errors (4xx) are expected noise.
  if (statusCode >= 500 && env.nodeEnv !== "test") {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code,
    ...(env.nodeEnv !== "production" && { stack: err.stack }),
  });
};
