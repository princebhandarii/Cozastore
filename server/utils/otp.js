import crypto from "crypto";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
export const OTP_MAX_SENDS_PER_HOUR = 5;

export const generateOtp = () => String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

// Bound to the order id so a code for one order can't verify another.
export const hashOtp = ({ secret, orderId, code }) =>
  crypto.createHmac("sha256", secret).update(`${orderId}:${code}`).digest("hex");

export const otpMatches = ({ secret, orderId, code, expectedHash }) => {
  const actual = Buffer.from(hashOtp({ secret, orderId, code: String(code || "") }), "hex");
  const expected = Buffer.from(String(expectedHash || ""), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};
