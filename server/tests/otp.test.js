import test from "node:test";
import assert from "node:assert/strict";
import { generateOtp, hashOtp, otpMatches, OTP_LENGTH } from "../utils/otp.js";

const secret = "s3cret";

test("generated codes are 6 digits, zero-padded, and vary", () => {
  const codes = new Set();
  for (let i = 0; i < 200; i++) {
    const c = generateOtp();
    assert.match(c, new RegExp(`^\\d{${OTP_LENGTH}}$`));
    codes.add(c);
  }
  assert.ok(codes.size > 100);
});

test("correct code verifies, wrong code does not", () => {
  const expectedHash = hashOtp({ secret, orderId: "o1", code: "123456" });
  assert.equal(otpMatches({ secret, orderId: "o1", code: "123456", expectedHash }), true);
  assert.equal(otpMatches({ secret, orderId: "o1", code: "123457", expectedHash }), false);
});

test("a code for one order cannot verify another order", () => {
  const expectedHash = hashOtp({ secret, orderId: "o1", code: "123456" });
  assert.equal(otpMatches({ secret, orderId: "o2", code: "123456", expectedHash }), false);
});

test("the stored value is not the code itself", () => {
  assert.ok(!hashOtp({ secret, orderId: "o1", code: "123456" }).includes("123456"));
});

test("garbage input never throws", () => {
  assert.equal(otpMatches({ secret, orderId: "o1", code: undefined, expectedHash: "zz" }), false);
});
