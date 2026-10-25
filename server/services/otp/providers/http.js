import { env } from "../../../config/env.js";
import { ApiError } from "../../../utils/ApiError.js";

// Generic HTTP SMS adapter. It POSTs { to, message, sender } as JSON with a
// Bearer token to SMS_API_URL. Most SMS vendors (MSG91, Twilio, Fast2SMS, ...)
// use a different request shape, so treat this as a template: copy this file,
// adapt the request to your vendor's docs, and register it in ../index.js.
export const name = "http";

export const sendSms = async ({ to, message }) => {
  const { smsApiUrl, smsApiKey, smsSenderId } = env.otp;
  if (!smsApiUrl || !smsApiKey) {
    throw new ApiError(500, "SMS_API_URL and SMS_API_KEY must be set for SMS_PROVIDER=http.", "SMS_NOT_CONFIGURED");
  }
  const res = await fetch(smsApiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${smsApiKey}` },
    body: JSON.stringify({ to, message, sender: smsSenderId }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`SMS provider responded with HTTP ${res.status}`);
};
