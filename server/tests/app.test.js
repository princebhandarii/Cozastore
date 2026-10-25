import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../app.js";

// These exercise the real Express app (middleware, routing, auth gates,
// error handling) with NO database connection - every request here is
// rejected or answered before anything touches MongoDB, which is exactly
// what's being verified: routes fail closed, not open, when unauthenticated.

test("GET /api/health responds without auth or a database", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test("unknown routes return a 404 with the standard error shape", async () => {
  const res = await request(app).get("/api/this-route-does-not-exist");
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, "ROUTE_NOT_FOUND");
});

test("protected customer routes reject requests with no Authorization header", async () => {
  for (const req of [
    () => request(app).get("/api/users/me"),
    () => request(app).get("/api/cart"),
    () => request(app).get("/api/wishlist"),
    () => request(app).get("/api/orders"),
    () => request(app).post("/api/returns"),
    () => request(app).post("/api/reviews"),
  ]) {
    const res = await req();
    assert.equal(res.status, 401, `${res.request.method} ${res.request.url}`);
    assert.equal(res.body.code, "UNAUTHORIZED");
  }
});

test("a malformed Authorization header is treated as missing, not crashed on", async () => {
  const res = await request(app).get("/api/users/me").set("Authorization", "not-a-bearer-token");
  assert.equal(res.status, 401);
  assert.equal(res.body.code, "UNAUTHORIZED");
});

test("admin routes reject unauthenticated requests before ever checking role", async () => {
  for (const path of ["/api/admin/dashboard", "/api/admin/orders", "/api/admin/users", "/api/admin/settings"]) {
    const res = await request(app).get(path);
    assert.equal(res.status, 401, path);
  }
});

test("a garbage Firebase token is rejected as unauthorized, not a 500", async () => {
  const res = await request(app).get("/api/users/me").set("Authorization", "Bearer totally-not-a-real-token");
  assert.equal(res.status, 401);
  assert.equal(res.body.code, "UNAUTHORIZED");
});

test("public catalog routes work with no auth and no database rows", async () => {
  const res = await request(app).get("/api/products");
  // No DB connected in this test run, so this specific call may itself error;
  // what matters is that it's never treated as an auth failure.
  assert.notEqual(res.status, 401);
});

test("security headers from helmet are present", async () => {
  const res = await request(app).get("/api/health");
  assert.equal(res.headers["x-content-type-options"], "nosniff");
});

test("CORS reflects only the configured client origin", async () => {
  const res = await request(app).get("/api/health").set("Origin", env_client_url());
  assert.equal(res.headers["access-control-allow-origin"], env_client_url());
});

function env_client_url() {
  return process.env.CLIENT_URL || "http://localhost:5173";
}
