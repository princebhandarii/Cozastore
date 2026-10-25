import { generateKeyPairSync } from "crypto";

// Preloaded via `node --import` before the test files run (see package.json).
//
// 1. Skips config/env.js's fail-fast required-var check (unit tests import
//    pure logic that pulls this module in transitively, without ever
//    calling connectDB or making a real Firebase call).
// 2. Provides a syntactically valid (but throwaway, not connected to any
//    real project) Firebase service-account key, because firebase-admin
//    validates the PEM's structure at initializeApp() time even before any
//    network call is made - tests/app.test.js exercises the real Express
//    app (incl. the auth middleware's early rejections), so the app must be
//    able to construct its Firebase Admin instance at import time.
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.FIREBASE_PROJECT_ID ||= "test-project";
process.env.FIREBASE_CLIENT_EMAIL ||= "test@test-project.iam.gserviceaccount.com";
if (!process.env.FIREBASE_PRIVATE_KEY) {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  process.env.FIREBASE_PRIVATE_KEY = privateKey;
}
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/test-unused";
