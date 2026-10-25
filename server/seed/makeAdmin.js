// Promotes an existing user to admin:  npm run make-admin -- you@example.com
// The user must have signed in at least once (that creates their MongoDB
// profile). This is deliberately a server-side script, not an API endpoint:
// nobody can grant themselves admin through the app.
import "../config/env.js";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

const email = process.argv[2]?.toLowerCase();
if (!email) {
  // eslint-disable-next-line no-console
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}

await connectDB();
const user = await User.findOneAndUpdate({ email }, { $set: { role: "admin" } }, { returnDocument: "after" });
// eslint-disable-next-line no-console
console.log(user ? `${user.email} is now an admin.` : `No user found with email ${email}. Sign in to the app once first.`);
await mongoose.disconnect();
process.exit(user ? 0 : 1);
