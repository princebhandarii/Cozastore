import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { razorpayWebhook } from "./controllers/paymentController.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

// Builds the Express app WITHOUT connecting to MongoDB or opening a port.
// Kept separate from server.js so tests (tests/app.test.js) and any
// serverless/edge wrapper can import a ready-to-use `app` without also
// triggering a real DB connection.
const app = express();

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
// Razorpay signs the RAW request body, so the webhook must be registered
// BEFORE express.json() and receive the untouched bytes.
app.post("/api/payments/webhook", express.raw({ type: "application/json", limit: "1mb" }), razorpayWebhook);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
}

// Rate limit every /api route. Individual sensitive routes layer a
// stricter limiter on top of this one (coupon validation, OTP, PIN checks).
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, slow down.", code: "RATE_LIMITED" },
});
app.use("/api", apiLimiter);

// --- Routes ---
app.use("/api", routes);

// --- 404 + centralized error handling ---
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
