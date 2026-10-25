import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { verifyCheckoutSignature, verifyWebhookSignature } from "../utils/razorpaySignature.js";

const secret = "test_secret";
const hmac = (data) => crypto.createHmac("sha256", secret).update(data).digest("hex");

test("accepts a correct checkout signature", () => {
  const signature = hmac("order_1|pay_1");
  assert.equal(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature, secret }), true);
});

test("rejects a tampered payment id", () => {
  const signature = hmac("order_1|pay_1");
  assert.equal(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_2", signature, secret }), false);
});

test("rejects a wrong-length / missing signature without throwing", () => {
  assert.equal(verifyCheckoutSignature({ orderId: "o", paymentId: "p", signature: "abc", secret }), false);
  assert.equal(verifyCheckoutSignature({ orderId: "o", paymentId: "p", signature: "", secret }), false);
});

test("rejects when signed with a different secret", () => {
  const forged = crypto.createHmac("sha256", "other").update("order_1|pay_1").digest("hex");
  assert.equal(verifyCheckoutSignature({ orderId: "order_1", paymentId: "pay_1", signature: forged, secret }), false);
});

test("webhook signature is computed over the raw body", () => {
  const body = Buffer.from('{"event":"payment.captured"}');
  const signature = hmac(body);
  assert.equal(verifyWebhookSignature({ rawBody: body, signature, secret }), true);
  assert.equal(verifyWebhookSignature({ rawBody: Buffer.from('{"event":"payment.captured" }'), signature, secret }), false);
});
