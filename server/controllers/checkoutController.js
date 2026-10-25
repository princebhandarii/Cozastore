import { z } from "zod";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { badRequest } from "../utils/ApiError.js";
import { prepareCheckout } from "../services/checkoutService.js";

const schema = z.object({
  addressId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Select a delivery address"),
  couponCode: z.string().max(30).optional().nullable(),
});

// POST /api/checkout/summary  { addressId, couponCode? }
// Read-only preview of exactly what POST /api/orders would charge.
export const checkoutSummary = asyncHandler(async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "VALIDATION_ERROR");

  const c = await prepareCheckout({ user: req.user, ...parsed.data });
  sendSuccess(res, {
    data: {
      items: c.lines,
      subtotal: c.subtotal,
      discount: c.discount,
      couponCode: c.couponCode,
      shippingCharge: c.shippingCharge,
      totalAmount: c.totalAmount,
      cod: c.cod,
      delivery: { city: c.serviceability.city, state: c.serviceability.state, message: c.serviceability.message },
    },
  });
});
