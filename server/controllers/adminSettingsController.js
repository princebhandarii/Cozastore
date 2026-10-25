import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { badRequest } from "../utils/ApiError.js";
import { getSettings } from "../services/settingsService.js";
import { logAdminAction } from "../utils/adminLog.js";

const codSchema = z
  .object({
    enabled: z.boolean(),
    minOrderAmount: z.coerce.number().min(0),
    maxOrderAmount: z.coerce.number().min(0),
    tokenType: z.enum(["fixed", "percentage"]),
    tokenValue: z.coerce.number().positive(),
    otpRequired: z.boolean(),
    cancellationPolicy: z.enum(["refundable", "non_refundable", "configurable"]),
  })
  .partial()
  .superRefine((v, ctx) => {
    if (v.tokenType === "percentage" && v.tokenValue !== undefined && v.tokenValue > 90) {
      ctx.addIssue({ code: "custom", message: "Token percentage cannot exceed 90", path: ["tokenValue"] });
    }
    if (v.minOrderAmount !== undefined && v.maxOrderAmount !== undefined && v.maxOrderAmount > 0 && v.minOrderAmount > v.maxOrderAmount) {
      ctx.addIssue({ code: "custom", message: "Minimum order amount cannot exceed the maximum", path: ["minOrderAmount"] });
    }
  });

// GET /api/admin/settings
export const getAdminSettings = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await getSettings() });
});

// PATCH /api/admin/settings/cod
export const updateCodSettings = asyncHandler(async (req, res) => {
  const parsed = codSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "VALIDATION_ERROR");

  const settings = await getSettings();
  const before = settings.toObject().cod;
  for (const [key, value] of Object.entries(parsed.data)) settings.set(`cod.${key}`, value);

  // Cross-check the merged result (partial updates can create bad combos).
  const merged = settings.toObject().cod;
  if (merged.tokenType === "percentage" && merged.tokenValue > 90) throw badRequest("Token percentage cannot exceed 90", "VALIDATION_ERROR");
  if (merged.maxOrderAmount > 0 && merged.minOrderAmount > merged.maxOrderAmount) {
    throw badRequest("Minimum order amount cannot exceed the maximum", "VALIDATION_ERROR");
  }

  await settings.save();
  await logAdminAction({
    admin: req.user,
    action: "COD_SETTINGS_UPDATED",
    targetType: "SiteSettings",
    targetId: settings._id,
    details: { before, after: settings.toObject().cod },
  });
  sendSuccess(res, { message: "COD settings saved", data: settings });
});
