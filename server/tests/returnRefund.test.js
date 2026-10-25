import test from "node:test";
import assert from "node:assert/strict";
import { computeReturnRefund, splitRefund, getReturnEligibility } from "../utils/returnRefund.js";

const order = {
  subtotal: 4000, discount: 400, shippingCharge: 50, totalAmount: 3650,
  items: [
    { _id: "a", unitPrice: 1000, quantity: 2 },
    { _id: "b", unitPrice: 2000, quantity: 1 },
  ],
};
const sel = (...pairs) => pairs.map(([id, quantity]) => ({ item: order.items.find((i) => i._id === id), quantity }));

test("partial return: coupon discount is shared proportionally, shipping not refunded", () => {
  const r = computeReturnRefund({ order, selections: sel(["a", 1]), reason: "SIZE_ISSUE" });
  assert.deepEqual(r, { itemsTotal: 1000, discountShare: 100, shipping: 0, amount: 900 });
});

test("full return for a store fault also refunds shipping", () => {
  const r = computeReturnRefund({ order, selections: sel(["a", 2], ["b", 1]), reason: "DAMAGED" });
  assert.equal(r.amount, 4000 - 400 + 50);
  assert.equal(r.amount, order.totalAmount);
});

test("full return because the customer changed their mind keeps shipping", () => {
  const r = computeReturnRefund({ order, selections: sel(["a", 2], ["b", 1]), reason: "NOT_AS_EXPECTED" });
  assert.equal(r.shipping, 0);
  assert.equal(r.amount, 3600);
});

test("returning all of one line but not the others is not a 'full' return", () => {
  const r = computeReturnRefund({ order, selections: sel(["a", 2]), reason: "DEFECTIVE" });
  assert.equal(r.shipping, 0);
});

test("refund can never exceed what was paid", () => {
  for (const reason of ["DAMAGED", "OTHER"]) {
    const r = computeReturnRefund({ order, selections: sel(["a", 2], ["b", 1]), reason });
    assert.ok(r.amount <= order.totalAmount);
  }
});

test("splitRefund: online payment covers everything it can, the rest is manual", () => {
  assert.deepEqual(splitRefund(900, 3650), { razorpayAmount: 900, manualAmount: 0 });
  assert.deepEqual(splitRefund(3000, 100), { razorpayAmount: 100, manualAmount: 2900 }); // COD: token online, cash manual
  assert.deepEqual(splitRefund(500, 0), { razorpayAmount: 0, manualAmount: 500 });
});

const delivered = (daysAgo) => ({ status: "DELIVERED", shipping: { deliveredAt: new Date(Date.now() - daysAgo * 86400000) } });
const rules = { enabled: true, windowDays: 7 };

test("eligibility: inside the window", () => {
  assert.equal(getReturnEligibility(delivered(3), rules, false).allowed, true);
});
test("eligibility: window expired", () => {
  const r = getReturnEligibility(delivered(8), rules, false);
  assert.equal(r.allowed, false);
  assert.match(r.reason, /7-day return window/);
});
test("eligibility: not delivered / already requested / disabled", () => {
  assert.equal(getReturnEligibility({ status: "SHIPPED" }, rules, false).allowed, false);
  assert.equal(getReturnEligibility(delivered(1), rules, true).allowed, false);
  assert.equal(getReturnEligibility(delivered(1), { ...rules, enabled: false }, false).allowed, false);
});
