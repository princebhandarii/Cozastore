import mongoose from "mongoose";

const otpChallengeSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    phone: { type: String, required: true },
    codeHash: { type: String, required: true }, // HMAC of the code - the code itself is never stored
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 1 },
    windowStart: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 }); // housekeeping

export default mongoose.model("OtpChallenge", otpChallengeSchema);
