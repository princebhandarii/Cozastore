import test from "node:test";
import assert from "node:assert/strict";
import * as t from "../services/email/templates.js";

const order = {
  orderNumber: "CZ-TEST-1", totalAmount: 3418, paymentMethod: "COD",
  items: [{ name: "Tee", size: "M", color: null, quantity: 2, lineTotal: 2998 }],
  cod: { tokenAmount: 100, remainingAmount: 3318, cancellationPolicy: "refundable", rejectionReason: "Out of stock" },
  shipping: { courier: "Delhivery", trackingNumber: "AWB123" },
};
const ret = { refundAmount: 900, status: "RETURN_APPROVED", adminNote: "Approved" };

test("every template returns a non-empty subject and html containing the order number", () => {
  const templates = [
    t.orderPlacedEmail(order), t.paymentSuccessEmail(order), t.codPendingEmail(order), t.codConfirmedEmail(order),
    t.codRejectedEmail(order), t.shippedEmail(order), t.outForDeliveryEmail(order), t.deliveredEmail(order),
    t.cancelledEmail(order, "Refund note"), t.returnRequestedEmail(ret, order), t.returnDecisionEmail(ret, order),
    t.refundInitiatedEmail(ret, order), t.refundCompletedEmail(ret, order),
  ];
  for (const tpl of templates) {
    assert.ok(tpl.subject.length > 0);
    assert.match(tpl.html, /CZ-TEST-1/);
    assert.match(tpl.html, /<!doctype html>/i);
  }
});

test("welcome email greets by name and falls back gracefully", () => {
  assert.match(t.welcomeEmail({ name: "Prince", email: "p@x.com" }).html, /Hi Prince/);
  assert.match(t.welcomeEmail({ email: "p@x.com" }).html, /Hi there/);
});

test("COD emails mention the token and remaining amounts", () => {
  assert.match(t.codPendingEmail(order).html, /₹100/);
  assert.match(t.codPendingEmail(order).html, /₹3,318/);
  assert.match(t.codConfirmedEmail(order).html, /₹3,318/);
});

test("COD rejection includes the reason when given", () => {
  assert.match(t.codRejectedEmail(order).html, /Out of stock/);
  const noReason = t.codRejectedEmail({ ...order, cod: { ...order.cod, rejectionReason: null } }).html;
  assert.doesNotMatch(noReason, /Reason:/);
});

test("shipped email includes courier and tracking number when present", () => {
  assert.match(t.shippedEmail(order).html, /Delhivery/);
  assert.match(t.shippedEmail(order).html, /AWB123/);
  assert.doesNotMatch(t.shippedEmail({ ...order, shipping: undefined }).html, /Courier:/);
});

test("return approval vs rejection use different subjects", () => {
  assert.match(t.returnDecisionEmail(ret, order).subject, /approved/i);
  assert.match(t.returnDecisionEmail({ ...ret, status: "RETURN_REJECTED" }, order).subject, /not approved/i);
});
