import test from "node:test";
import assert from "node:assert/strict";
import { sendWelcomeEmail } from "../services/email/emailService.js";

test("dev console transport never throws even without SMTP configured", async () => {
  // NODE_ENV in this test run is not "production" and no EMAIL_HOST is set,
  // so this should use the jsonTransport dev adapter and resolve quietly.
  const result = await sendWelcomeEmail({ name: "Test", email: "test@example.com" });
  assert.ok(result === null || typeof result === "object");
});
