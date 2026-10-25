import { env } from "../../config/env.js";
import OtpChallenge from "../../models/OtpChallenge.js";
import Order from "../../models/Order.js";
import { ApiError, badRequest } from "../../utils/ApiError.js";
import {
  generateOtp, hashOtp, otpMatches,
  OTP_TTL_MS, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_MS, OTP_MAX_SENDS_PER_HOUR,
} from "../../utils/otp.js";
import * as consoleProvider from "./providers/console.js";
import * as httpProvider from "./providers/http.js";

// Every provider exports: name, sendSms({ to, message }).
const providers = { [consoleProvider.name]: consoleProvider, [httpProvider.name]: httpProvider };

const getProvider = () => {
  const provider = providers[env.otp.provider];
  if (!provider) throw new ApiError(500, `Unknown SMS_PROVIDER "${env.otp.provider}"`, "SMS_NOT_CONFIGURED");
  return provider;
};

const getSecret = () => {
  if (env.otp.secret) return env.otp.secret;
  if (env.nodeEnv === "production") {
    throw new ApiError(500, "OTP_SECRET must be set in production.", "OTP_NOT_CONFIGURED");
  }
  return "dev-only-otp-secret";
};

const assertOtpApplicable = (order) => {
  if (order.paymentMethod !== "COD" || !order.cod?.otpRequired) {
    throw badRequest("Phone verification is not required for this order", "OTP_NOT_REQUIRED");
  }
  if (!["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status)) {
    throw new ApiError(409, "This order can no longer be verified", "ORDER_NOT_PAYABLE");
  }
};

export const sendCodOtp = async (order) => {
  assertOtpApplicable(order);
  if (order.cod.otpVerified) throw badRequest("Phone already verified", "OTP_ALREADY_VERIFIED");

  const now = Date.now();
  const existing = await OtpChallenge.findOne({ order: order._id });
  let sendCount = 1;
  let windowStart = new Date(now);

  if (existing) {
    if (now - existing.lastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
      throw new ApiError(429, "Please wait before requesting another code", "OTP_COOLDOWN");
    }
    const inWindow = now - existing.windowStart.getTime() < 60 * 60 * 1000;
    sendCount = inWindow ? existing.sendCount + 1 : 1;
    windowStart = inWindow ? existing.windowStart : new Date(now);
    if (inWindow && existing.sendCount >= OTP_MAX_SENDS_PER_HOUR) {
      throw new ApiError(429, "Too many codes requested. Try again later.", "OTP_SEND_LIMIT");
    }
  }

  const code = generateOtp();
  const phone = order.shippingAddress.phone;
  await OtpChallenge.findOneAndUpdate(
    { order: order._id },
    {
      $set: {
        user: order.user,
        phone,
        codeHash: hashOtp({ secret: getSecret(), orderId: String(order._id), code }),
        attempts: 0,
        sendCount,
        windowStart,
        lastSentAt: new Date(now),
        expiresAt: new Date(now + OTP_TTL_MS),
      },
    },
    { upsert: true }
  );

  try {
    await getProvider().sendSms({ to: `+91${phone}`, message: `${code} is your Coza Store verification code for order ${order.orderNumber}. Valid for 5 minutes.` });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(502, "Could not send the verification code. Please try again.", "OTP_SEND_FAILED");
  }
  return { phoneLast4: phone.slice(-4), expiresInSeconds: OTP_TTL_MS / 1000 };
};

export const verifyCodOtp = async (order, code) => {
  assertOtpApplicable(order);
  if (order.cod.otpVerified) return order;

  // Increment first so parallel guesses can't exceed the attempt limit.
  const challenge = await OtpChallenge.findOneAndUpdate({ order: order._id }, { $inc: { attempts: 1 } }, { returnDocument: "after" });
  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    throw badRequest("This code has expired. Request a new one.", "OTP_EXPIRED");
  }
  if (challenge.attempts > OTP_MAX_ATTEMPTS) {
    throw new ApiError(429, "Too many incorrect attempts. Request a new code.", "OTP_ATTEMPTS_EXCEEDED");
  }
  const ok = otpMatches({ secret: getSecret(), orderId: String(order._id), code, expectedHash: challenge.codeHash });
  if (!ok) throw badRequest("Incorrect code", "OTP_INVALID");

  await Order.updateOne({ _id: order._id }, { $set: { "cod.otpVerified": true } });
  await OtpChallenge.deleteOne({ _id: challenge._id });
  return Order.findById(order._id);
};
