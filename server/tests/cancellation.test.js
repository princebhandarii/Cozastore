import test from "node:test";
import assert from "node:assert/strict";
import { getCancellationRule, DEFAULT_ORDER_RULES } from "../utils/cancellation.js";

const online = (status) => ({ status, paymentMethod: "ONLINE" });
const cod = (status, cancellationPolicy) => ({ status, paymentMethod: "COD", cod: { cancellationPolicy } });

test("unpaid orders can always be cancelled with nothing to refund", () => {
  assert.deepEqual(getCancellationRule(online("PENDING_PAYMENT")), { allowed: true, refund: "none" });
  assert.deepEqual(getCancellationRule(online("PAYMENT_FAILED")), { allowed: true, refund: "none" });
});

test("confirmed online order: cancellable by default with a full refund", () => {
  assert.deepEqual(getCancellationRule(online("CONFIRMED")), { allowed: true, refund: "full" });
});

test("admin can switch off cancellation of confirmed orders", () => {
  const r = getCancellationRule(online("CONFIRMED"), { ...DEFAULT_ORDER_RULES, cancelWhenConfirmed: false });
  assert.equal(r.allowed, false);
});

test("processing orders: blocked by default, configurable", () => {
  assert.equal(getCancellationRule(online("PROCESSING")).allowed, false);
  assert.equal(getCancellationRule(online("PROCESSING"), { ...DEFAULT_ORDER_RULES, cancelWhenProcessing: true }).allowed, true);
});

test("shipped / out for delivery / delivered can't be cancelled", () => {
  for (const s of ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"]) assert.equal(getCancellationRule(online(s)).allowed, false);
  assert.match(getCancellationRule(online("DELIVERED")).reason, /returned/);
});

test("COD token refund follows the order's snapshotted policy", () => {
  assert.equal(getCancellationRule(cod("PENDING_COD_CONFIRMATION", "refundable")).refund, "token");
  assert.equal(getCancellationRule(cod("PENDING_COD_CONFIRMATION", "non_refundable")).refund, "none");
  assert.equal(getCancellationRule(cod("CONFIRMED", "configurable")).refund, "review");
});

test("already-cancelled or returned orders can't be cancelled again", () => {
  for (const s of ["CANCELLED", "RETURN_REQUESTED", "REFUNDED"]) assert.equal(getCancellationRule(online(s)).allowed, false);
});
