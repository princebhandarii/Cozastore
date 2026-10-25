import dotenv from "dotenv";
dotenv.config();

const required = [
  "MONGODB_URI",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
];

// Fail loudly and early rather than starting a server that will error
// on the first real request. Each phase adds its own required keys here.
// Skipped under the test runner: unit tests import pure logic that pulls
// this module in transitively, without ever calling connectDB/Firebase.
const missing = process.env.NODE_ENV === "test" ? [] : required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.error(
    `\nMissing required environment variables: ${missing.join(", ")}\n` +
      `Copy server/.env.example to server/.env and fill these in.\n`
  );
  process.exit(1);
}

const numEnv = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5001,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  mongodbUri: process.env.MONGODB_URI,

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Private keys stored in .env have their newlines escaped as \n;
    // Firebase's SDK needs them turned back into real newlines.
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },

  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 300,
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  shipping: {
    provider: process.env.SHIPPING_PROVIDER || "pincode-lookup",
    freeThreshold: numEnv("FREE_SHIPPING_THRESHOLD", 999),
    flatCharge: numEnv("FLAT_SHIPPING_CHARGE", 50),
  },

  shiprocket: {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
    pickupPincode: process.env.SHIPROCKET_PICKUP_PINCODE,
    pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || "Primary",
    webhookToken: process.env.SHIPROCKET_WEBHOOK_TOKEN,
  },

  // Seller details printed on invoices. GST_RATE_PERCENT=0 prints no tax lines.
  store: {
    name: process.env.STORE_NAME || "Coza Store",
    address: process.env.STORE_ADDRESS || "",
    state: process.env.STORE_STATE || "",
    gstin: process.env.STORE_GSTIN || "",
    email: process.env.STORE_EMAIL || "",
    phone: process.env.STORE_PHONE || "",
    gstRatePercent: numEnv("GST_RATE_PERCENT", 0),
  },

  email: {
    provider: process.env.EMAIL_PROVIDER || (process.env.EMAIL_HOST ? "smtp" : "console"),
    host: process.env.EMAIL_HOST,
    port: numEnv("EMAIL_PORT", 587),
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || `"Coza Store" <${process.env.EMAIL_USER || "no-reply@example.com"}>`,
  },

  otp: {
    provider: process.env.SMS_PROVIDER || "console",
    secret: process.env.OTP_SECRET,
    smsApiUrl: process.env.SMS_API_URL,
    smsApiKey: process.env.SMS_API_KEY,
    smsSenderId: process.env.SMS_SENDER_ID,
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};
