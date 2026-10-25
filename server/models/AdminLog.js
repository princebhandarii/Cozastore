import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true }, // e.g. COD_CONFIRMED, COD_REJECTED, COD_SETTINGS_UPDATED
    targetType: { type: String, default: null },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "at", updatedAt: false } }
);

export default mongoose.model("AdminLog", adminLogSchema);
