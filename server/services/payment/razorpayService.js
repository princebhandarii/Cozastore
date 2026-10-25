import Razorpay from "razorpay";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { verifyCheckoutSignature, verifyWebhookSignature } from "../../utils/razorpaySignature.js";

let client;

// Test seam: lets integration tests inject a fake Razorpay client so no network
// or real credentials are needed. Never called by application code.
export const __setRazorpayClientForTests = (fake) => { client = fake; };
const getClient = () => {
  if (client) return client;
  const { keyId, keySecret } = env.razorpay;
  if (!keyId || !keySecret) {
    throw new ApiError(
      500,
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.",
      "RAZORPAY_NOT_CONFIGURED"
    );
  }
  client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
};

export const getPublicKeyId = () => {
  getClient();
  return env.razorpay.keyId;
};

const toPaise = (rupees) => Math.round(rupees * 100);

// Creates a Razorpay order for an amount the SERVER computed.
export const createRazorpayOrder = ({ amountRupees, receipt, notes = {} }) =>
  getClient().orders.create({ amount: toPaise(amountRupees), currency: "INR", receipt, notes });

export const verifyPaymentSignature = ({ orderId, paymentId, signature }) =>
  verifyCheckoutSignature({ orderId, paymentId, signature, secret: env.razorpay.keySecret });

export const verifyWebhook = ({ rawBody, signature }) =>
  verifyWebhookSignature({ rawBody, signature, secret: env.razorpay.webhookSecret });

export const refundRazorpayPayment = ({ paymentId, amountRupees, notes = {} }) =>
  getClient().payments.refund(paymentId, { amount: toPaise(amountRupees), notes });
