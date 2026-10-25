import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "./env.js";

// The backend verifies every Firebase ID token itself using this Admin
// SDK credential - it never trusts a token's claims without checking
// them against Firebase's servers first.
const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      privateKey: env.firebase.privateKey,
    }),
  });

export const firebaseAuth = getAuth(app);
export default app;
