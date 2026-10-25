import test from "node:test";
import assert from "node:assert/strict";
import { calculateShippingCharge } from "../utils/shippingCharge.js";

const cfg = { freeThreshold: 999, flatCharge: 50 };

test("charges flat shipping below the threshold", () => {
  assert.equal(calculateShippingCharge(998, cfg), 50);
});
test("free shipping at and above the threshold", () => {
  assert.equal(calculateShippingCharge(999, cfg), 0);
  assert.equal(calculateShippingCharge(5000, cfg), 0);
});
