import { ApiError } from "../../../utils/ApiError.js";

// DEVELOPMENT-ONLY adapter: prints the OTP to the server console instead of
// sending an SMS. It refuses to run in production so a real customer can
// never be asked for a code that was never delivered.
export const name = "console";

export const sendSms = async ({ to, message }) => {
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(500, "SMS provider is not configured (SMS_PROVIDER=console is development-only).", "SMS_NOT_CONFIGURED");
  }
  // eslint-disable-next-line no-console
  console.log(`\n[DEV OTP - not a real SMS] to ${to}: ${message}\n`);
};
