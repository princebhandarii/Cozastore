import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { badRequest } from "../utils/ApiError.js";
import { checkServiceability } from "../services/shipping/index.js";

const schema = z.object({ pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit PIN code") });

// POST /api/shipping/check  { pincode }
export const checkPincode = asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "INVALID_PINCODE");
  const result = await checkServiceability(parsed.data.pincode);
  sendSuccess(res, { data: result });
});
