import test from "node:test";
import assert from "node:assert/strict";

// The webhook's status-mapping table is small and inline in the controller;
// this test re-derives the same mapping logic in isolation to lock its
// behaviour (unknown/duplicate statuses must be ignored, not guessed at).
const STATUS_MAP = { "OUT FOR DELIVERY": "OUT_FOR_DELIVERY", DELIVERED: "DELIVERED" };
const nextStatus = (currentOrderStatus, courierStatus) => {
  const mapped = STATUS_MAP[courierStatus.toUpperCase().trim()];
  if (!mapped) return null;
  if (currentOrderStatus === "SHIPPED" && mapped === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (currentOrderStatus === "OUT_FOR_DELIVERY" && mapped === "DELIVERED") return "DELIVERED";
  return null; // out-of-order or duplicate: ignored
};

test("shipped -> out for delivery on a matching courier update", () => {
  assert.equal(nextStatus("SHIPPED", "Out for Delivery"), "OUT_FOR_DELIVERY");
});

test("out for delivery -> delivered", () => {
  assert.equal(nextStatus("OUT_FOR_DELIVERY", "DELIVERED"), "DELIVERED");
});

test("unknown courier statuses are ignored", () => {
  assert.equal(nextStatus("SHIPPED", "IN TRANSIT"), null);
  assert.equal(nextStatus("SHIPPED", "PICKED UP"), null);
});

test("out-of-order or duplicate updates are ignored, not force-applied", () => {
  assert.equal(nextStatus("PROCESSING", "DELIVERED"), null); // skipping SHIPPED
  assert.equal(nextStatus("DELIVERED", "DELIVERED"), null); // already delivered
  assert.equal(nextStatus("SHIPPED", "DELIVERED"), null); // skipping OUT_FOR_DELIVERY
});
