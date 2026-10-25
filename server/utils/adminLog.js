import AdminLog from "../models/AdminLog.js";

// Best-effort audit trail: a logging failure must never break the admin action.
export const logAdminAction = async ({ admin, action, targetType = null, targetId = null, details = null }) => {
  try {
    await AdminLog.create({ admin: admin._id, action, targetType, targetId, details });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to write admin log:", err.message);
  }
};
