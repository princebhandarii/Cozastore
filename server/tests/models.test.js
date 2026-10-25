import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import SiteSettings from "../models/SiteSettings.js";

const baseOrder = () => ({
  orderNumber: "CZ-TEST-1",
  user: new mongoose.Types.ObjectId(),
  items: [{ product: new mongoose.Types.ObjectId(), name: "Tee", quantity: 1, unitPrice: 1000, lineTotal: 1000 }],
  shippingAddress: { fullName: "A", phone: "9876543210", city: "Surat", state: "Gujarat", pincode: "395001" },
  subtotal: 1000, totalAmount: 1050, shippingCharge: 50, paymentMethod: "COD",
  cod: { tokenAmount: 100, remainingAmount: 950 },
});

test("COD order validates and defaults to AWAITING_TOKEN / PENDING_PAYMENT", () => {
  const o = new Order(baseOrder());
  assert.equal(o.validateSync(), undefined);
  assert.equal(o.cod.confirmationStatus, "AWAITING_TOKEN");
  assert.equal(o.status, "PENDING_PAYMENT");
  assert.equal(o.cod.tokenPaid, false);
  assert.equal(o.cod.remainingPaymentMethod, "COD");
});

test("online orders carry no cod block", () => {
  const data = baseOrder();
  delete data.cod;
  data.paymentMethod = "ONLINE";
  assert.equal(new Order(data).cod, undefined);
});

test("pushStatus enforces the transition table and writes history", () => {
  const o = new Order(baseOrder());
  o.pushStatus("PENDING_COD_CONFIRMATION", "token paid", "system");
  assert.equal(o.status, "PENDING_COD_CONFIRMATION");
  assert.equal(o.timeline.length, 1);
  assert.throws(() => o.pushStatus("SHIPPED"), /Cannot change order status/);
  assert.equal(o.status, "PENDING_COD_CONFIRMATION");
});

test("site settings default to COD disabled (opt-in) and reject bad enums", () => {
  const s = new SiteSettings({});
  assert.equal(s.cod.enabled, false);
  assert.equal(s.cod.tokenType, "fixed");
  s.set("cod.tokenType", "bogus");
  assert.ok(s.validateSync().errors["cod.tokenType"]);
});

test("nested cod settings can be updated field by field", () => {
  const s = new SiteSettings({});
  s.set("cod.enabled", true);
  s.set("cod.tokenValue", 250);
  assert.equal(s.toObject().cod.enabled, true);
  assert.equal(s.toObject().cod.tokenValue, 250);
  assert.equal(s.toObject().cod.otpRequired, false);
});

test("shipping block is optional and defaults are safe", () => {
  const o = new Order(baseOrder());
  assert.equal(o.shipping, undefined);
  assert.equal(o.needsRefundDecision, false);
  o.set("shipping.courier", "Delhivery");
  assert.equal(o.shipping.provider, "manual");
});

test("order rules default: confirmed cancellable, processing not", () => {
  const s = new SiteSettings({});
  assert.equal(s.orders.cancelWhenConfirmed, true);
  assert.equal(s.orders.cancelWhenProcessing, false);
});

import ReturnRequest from "../models/ReturnRequest.js";
import Review from "../models/Review.js";

test("return request requires items, a valid reason and a computed refund", () => {
  const r = new ReturnRequest({ order: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(), reason: "BOGUS", items: [], refundAmount: 100 });
  const errs = r.validateSync().errors;
  assert.ok(errs.reason);
  assert.ok(errs.items);
});

test("return request defaults: RETURN_REQUESTED, nothing refunded yet", () => {
  const r = new ReturnRequest({
    order: new mongoose.Types.ObjectId(), user: new mongoose.Types.ObjectId(), reason: "DAMAGED", refundAmount: 500,
    items: [{ orderItemId: new mongoose.Types.ObjectId(), product: new mongoose.Types.ObjectId(), quantity: 1, unitPrice: 500 }],
  });
  assert.equal(r.validateSync(), undefined);
  assert.equal(r.status, "RETURN_REQUESTED");
  assert.equal(r.refund.planned, false);
  assert.equal(r.refund.razorpayInitiated, false);
});

test("review rating must be an integer-range 1-5", () => {
  const base = { user: new mongoose.Types.ObjectId(), product: new mongoose.Types.ObjectId(), order: new mongoose.Types.ObjectId() };
  assert.ok(new Review({ ...base, rating: 0 }).validateSync().errors.rating);
  assert.ok(new Review({ ...base, rating: 6 }).validateSync().errors.rating);
  assert.equal(new Review({ ...base, rating: 5 }).validateSync(), undefined);
  assert.equal(new Review({ ...base, rating: 5 }).status, "PUBLISHED");
});

test("pushStatus records confirmedAt the first time an order becomes CONFIRMED (and never overwrites it)", () => {
  const o = new Order(baseOrder());
  assert.equal(o.confirmedAt, null);
  o.pushStatus("CONFIRMED", "paid", "system");
  const first = o.confirmedAt;
  assert.ok(first instanceof Date);
  o.pushStatus("PROCESSING", "", "admin");
  assert.equal(o.confirmedAt, first);
});

test("COD orders are not 'confirmed' until the store accepts them", () => {
  const o = new Order(baseOrder());
  o.pushStatus("PENDING_COD_CONFIRMATION", "token paid", "system");
  assert.equal(o.confirmedAt, null);
});
