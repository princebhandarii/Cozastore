import test from "node:test";
import assert from "node:assert/strict";
import { calculateCodToken, evaluateCodEligibility } from "../utils/codToken.js";

const base = { enabled: true, minOrderAmount: 500, maxOrderAmount: 20000, tokenType: "fixed", tokenValue: 100 };

test("fixed token: ₹2,050 order (₹2,000 + ₹50 shipping) with ₹100 token leaves ₹1,950", () => {
  const r = evaluateCodEligibility(base, 2050);
  assert.deepEqual(r, { available: true, tokenAmount: 100, remainingAmount: 1950 });
});

test("percentage token rounds to whole rupees", () => {
  assert.equal(calculateCodToken({ totalAmount: 1999, tokenType: "percentage", tokenValue: 10 }), 200);
  const r = evaluateCodEligibility({ ...base, tokenType: "percentage", tokenValue: 10 }, 1999);
  assert.equal(r.tokenAmount, 200);
  assert.equal(r.remainingAmount, 1799);
});

test("COD disabled", () => {
  assert.equal(evaluateCodEligibility({ ...base, enabled: false }, 2000).available, false);
});

test("below minimum and above maximum are rejected", () => {
  assert.equal(evaluateCodEligibility(base, 499).available, false);
  assert.equal(evaluateCodEligibility(base, 20001).available, false);
  assert.equal(evaluateCodEligibility(base, 500).available, true);
  assert.equal(evaluateCodEligibility(base, 20000).available, true);
});

test("maxOrderAmount 0 means no upper limit", () => {
  assert.equal(evaluateCodEligibility({ ...base, maxOrderAmount: 0 }, 900000).available, true);
});

test("token that would cover the whole order is rejected (no COD balance left)", () => {
  const r = evaluateCodEligibility({ ...base, minOrderAmount: 0, tokenValue: 600 }, 600);
  assert.equal(r.available, false);
});

test("zero token is a misconfiguration, not free COD", () => {
  assert.equal(evaluateCodEligibility({ ...base, tokenValue: 0 }, 2000).available, false);
});
