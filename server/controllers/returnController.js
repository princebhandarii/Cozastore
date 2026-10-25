import mongoose from "mongoose";
import { z } from "zod";
import Order from "../models/Order.js";
import ReturnRequest, { RETURN_REASONS } from "../models/ReturnRequest.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { getSettings } from "../services/settingsService.js";
import { computeReturnRefund, getReturnEligibility } from "../utils/returnRefund.js";
import { uploadBufferToCloudinary, deleteFromCloudinary } from "../services/cloudinary/cloudinaryService.js";
import { sendReturnRequestedEmail } from "../services/email/emailService.js";

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v);

const bodySchema = z.object({
  orderId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid order"),
  reason: z.enum(RETURN_REASONS, { message: "Choose a return reason" }),
  description: z.string().trim().max(1000).optional().default(""),
  // multipart forms send arrays as JSON text
  items: z.preprocess((v) => (typeof v === "string" ? JSON.parse(v) : v), z.array(z.object({
    itemId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    quantity: z.coerce.number().int().min(1),
  })).min(1, "Select at least one item").max(50)),
});

const parseBody = (body) => {
  let parsed;
  try { parsed = bodySchema.safeParse(body); } catch { throw badRequest("Invalid items", "VALIDATION_ERROR"); }
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "VALIDATION_ERROR");
  return parsed.data;
};

// Validates the selection against the ORDER (never against client-sent prices).
const buildSelections = (order, items) => {
  const seen = new Set();
  return items.map(({ itemId, quantity }) => {
    if (seen.has(itemId)) throw badRequest("Each item can only be listed once", "VALIDATION_ERROR");
    seen.add(itemId);
    const item = order.items.id(itemId);
    if (!item) throw badRequest("One of the selected items is not part of this order", "INVALID_ITEM");
    if (quantity > item.quantity) throw badRequest(`You only bought ${item.quantity} of "${item.name}"`, "INVALID_QUANTITY");
    return { item, quantity };
  });
};

const loadOrderForReturn = async (req, orderId) => {
  const order = await Order.findOne({ _id: orderId, user: req.user._id });
  if (!order) throw notFound("Order not found");
  const settings = await getSettings();
  const existing = await ReturnRequest.exists({ order: order._id });
  const eligibility = getReturnEligibility(order, settings.toObject().returns, Boolean(existing));
  if (!eligibility.allowed) throw new ApiError(409, eligibility.reason, "RETURN_NOT_ALLOWED");
  return order;
};

// POST /api/returns/preview  { orderId, reason, items } -> what the refund would be
export const previewReturn = asyncHandler(async (req, res) => {
  const body = parseBody(req.body);
  const order = await loadOrderForReturn(req, body.orderId);
  const selections = buildSelections(order, body.items);
  sendSuccess(res, { data: computeReturnRefund({ order, selections, reason: body.reason }) });
});

// POST /api/returns  (multipart: orderId, reason, description, items JSON, images[])
export const createReturn = asyncHandler(async (req, res) => {
  const body = parseBody(req.body);
  const order = await loadOrderForReturn(req, body.orderId);
  const selections = buildSelections(order, body.items);
  const breakdown = computeReturnRefund({ order, selections, reason: body.reason });

  const images = [];
  try {
    for (const file of req.files || []) images.push(await uploadBufferToCloudinary(file.buffer, "cozastore/returns"));

    const session = await mongoose.startSession();
    let created;
    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const entry = { status: "RETURN_REQUESTED", note: `Reason: ${body.reason.replaceAll("_", " ").toLowerCase()}`, actor: "customer", at: now };
        // Atomic gate: only a DELIVERED order can enter the return flow.
        const gated = await Order.findOneAndUpdate(
          { _id: order._id, user: req.user._id, status: "DELIVERED" },
          { $set: { status: "RETURN_REQUESTED" }, $push: { timeline: entry } },
          { returnDocument: "after", session }
        );
        if (!gated) throw new ApiError(409, "This order is no longer eligible for a return", "RETURN_NOT_ALLOWED");
        [created] = await ReturnRequest.create([{
          order: order._id,
          user: req.user._id,
          items: selections.map(({ item, quantity }) => ({
            orderItemId: item._id, product: item.product, variantId: item.variantId, name: item.name, sku: item.sku,
            image: item.image, size: item.size, color: item.color, quantity, unitPrice: item.unitPrice,
          })),
          reason: body.reason,
          description: body.description,
          images,
          refundAmount: breakdown.amount,
          refundBreakdown: { itemsTotal: breakdown.itemsTotal, discountShare: breakdown.discountShare, shipping: breakdown.shipping },
          timeline: [entry],
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    sendReturnRequestedEmail(created, order, req.user.email);
    sendSuccess(res, { statusCode: 201, message: "Return requested", data: created });
  } catch (err) {
    for (const img of images) await deleteFromCloudinary(img.publicId).catch(() => {}); // don't orphan uploads
    throw err;
  }
});

// GET /api/returns
export const listMyReturns = asyncHandler(async (req, res) => {
  const items = await ReturnRequest.find({ user: req.user._id }).populate("order", "orderNumber").sort({ createdAt: -1 }).limit(100);
  sendSuccess(res, { data: items });
});

// GET /api/returns/:id
export const getMyReturn = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw notFound("Return not found");
  const ret = await ReturnRequest.findOne({ _id: req.params.id, user: req.user._id }).populate("order", "orderNumber totalAmount paymentMethod");
  if (!ret) throw notFound("Return not found");
  sendSuccess(res, { data: ret });
});
