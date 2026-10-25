import test from "node:test";
import assert from "node:assert/strict";
import { canTransition, assertTransition, TRANSITIONS, ORDER_STATUSES } from "../utils/orderStatus.js";

test("main happy path is allowed step by step", () => {
  const path = ["PENDING_PAYMENT", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
  for (let i = 0; i < path.length - 1; i++) assert.equal(canTransition(path[i], path[i + 1]), true);
});

test("skipping states is rejected", () => {
  assert.equal(canTransition("CONFIRMED", "SHIPPED"), false);
  assert.equal(canTransition("PENDING_PAYMENT", "DELIVERED"), false);
  assert.throws(() => assertTransition("SHIPPED", "CANCELLED"), /Cannot change order status/);
});

test("terminal states have no exits", () => {
  for (const s of ["CANCELLED", "REFUNDED", "RETURN_REJECTED"]) assert.deepEqual(TRANSITIONS[s], []);
});

test("return flow follows the specified order", () => {
  const path = ["DELIVERED", "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_PICKED_UP", "RETURNED", "REFUND_INITIATED", "REFUNDED"];
  for (let i = 0; i < path.length - 1; i++) assert.equal(canTransition(path[i], path[i + 1]), true);
});

test("every transition target is a known status", () => {
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    assert.ok(ORDER_STATUSES.includes(from));
    for (const to of tos) assert.ok(ORDER_STATUSES.includes(to), `${from} -> ${to}`);
  }
});

test("COD flow: token paid -> pending confirmation -> confirmed or cancelled", () => {
  assert.equal(canTransition("PENDING_PAYMENT", "PENDING_COD_CONFIRMATION"), true);
  assert.equal(canTransition("PENDING_COD_CONFIRMATION", "CONFIRMED"), true);
  assert.equal(canTransition("PENDING_COD_CONFIRMATION", "CANCELLED"), true);
  assert.equal(canTransition("PENDING_COD_CONFIRMATION", "SHIPPED"), false);
});
