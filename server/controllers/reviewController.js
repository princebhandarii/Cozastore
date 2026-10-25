import { z } from "zod";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { getReviewEligibility, refreshProductRating } from "../services/reviewService.js";
import { uploadBufferToCloudinary, deleteFromCloudinary } from "../services/cloudinary/cloudinaryService.js";
import { logAdminAction } from "../utils/adminLog.js";

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v);

const createSchema = z.object({
  productId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid product"),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  comment: z.string().trim().max(1000).optional().default(""),
});

// GET /api/reviews/can-review/:productId (auth)
export const canReview = asyncHandler(async (req, res) => {
  if (!isId(req.params.productId)) throw notFound("Product not found");
  const { orderId, ...rest } = await getReviewEligibility(req.user._id, req.params.productId);
  sendSuccess(res, { data: rest });
});

// POST /api/reviews  (multipart: productId, rating, comment, images[])
export const createReview = asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0].message, "VALIDATION_ERROR");
  const { productId, rating, comment } = parsed.data;

  const product = await Product.findById(productId);
  if (!product) throw notFound("Product not found");

  // The backend decides who may review - not the client.
  const eligibility = await getReviewEligibility(req.user._id, productId);
  if (eligibility.hasReviewed) throw new ApiError(409, eligibility.reason, "ALREADY_REVIEWED");
  if (!eligibility.canReview) throw new ApiError(403, eligibility.reason, "NOT_A_VERIFIED_PURCHASER");

  const images = [];
  try {
    for (const file of (req.files || []).slice(0, 3)) images.push(await uploadBufferToCloudinary(file.buffer, "cozastore/reviews"));
    const review = await Review.create({ user: req.user._id, product: productId, order: eligibility.orderId, rating, comment, images });
    await refreshProductRating(productId);
    sendSuccess(res, { statusCode: 201, message: "Thanks for your review", data: review });
  } catch (err) {
    for (const img of images) await deleteFromCloudinary(img.publicId).catch(() => {});
    throw err;
  }
});

// GET /api/products/:id/reviews  (public; :id may be a product id or slug)
export const listProductReviews = asyncHandler(async (req, res) => {
  const product = isId(req.params.id) ? await Product.findById(req.params.id) : await Product.findOne({ slug: req.params.id });
  if (!product) throw notFound("Product not found");

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const filter = { product: product._id, status: "PUBLISHED" };

  const [items, total, dist] = await Promise.all([
    Review.find(filter).populate("user", "name").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Review.countDocuments(filter),
    Review.aggregate([{ $match: filter }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  dist.forEach((d) => { distribution[d._id] = d.n; });

  sendSuccess(res, {
    data: items.map((r) => {
      const [first, ...rest] = (r.user?.name || "Customer").split(" ");
      return { _id: r._id, rating: r.rating, comment: r.comment, images: r.images, createdAt: r.createdAt,
        author: rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first, verified: true, mine: String(r.user?._id) === String(req.user?._id) };
    }),
    meta: { page, pages: Math.ceil(total / limit), total, average: product.ratings, distribution },
  });
});

// DELETE /api/reviews/:id  (own review)
export const deleteMyReview = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw notFound("Review not found");
  const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
  if (!review) throw notFound("Review not found");
  for (const img of review.images) await deleteFromCloudinary(img.publicId).catch(() => {});
  await review.deleteOne();
  await refreshProductRating(review.product);
  sendSuccess(res, { message: "Review deleted" });
});

// ---- Admin moderation ----
export const adminListReviews = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    if (!["PUBLISHED", "HIDDEN"].includes(req.query.status)) throw badRequest("Unknown status");
    filter.status = req.query.status;
  }
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const [items, total] = await Promise.all([
    Review.find(filter).populate("user", "name email").populate("product", "name slug").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Review.countDocuments(filter),
  ]);
  sendSuccess(res, { data: items, meta: { page, pages: Math.ceil(total / limit), total } });
});

export const adminSetReviewStatus = asyncHandler(async (req, res) => {
  const parsed = z.object({ status: z.enum(["PUBLISHED", "HIDDEN"]) }).safeParse(req.body);
  if (!parsed.success) throw badRequest("status must be PUBLISHED or HIDDEN", "VALIDATION_ERROR");
  if (!isId(req.params.id)) throw notFound("Review not found");
  const review = await Review.findByIdAndUpdate(req.params.id, { $set: { status: parsed.data.status } }, { returnDocument: "after" });
  if (!review) throw notFound("Review not found");
  await refreshProductRating(review.product);
  await logAdminAction({ admin: req.user, action: "REVIEW_MODERATED", targetType: "Review", targetId: review._id, details: { status: parsed.data.status } });
  sendSuccess(res, { message: "Review updated", data: review });
});

export const adminDeleteReview = asyncHandler(async (req, res) => {
  if (!isId(req.params.id)) throw notFound("Review not found");
  const review = await Review.findById(req.params.id);
  if (!review) throw notFound("Review not found");
  for (const img of review.images) await deleteFromCloudinary(img.publicId).catch(() => {});
  await review.deleteOne();
  await refreshProductRating(review.product);
  await logAdminAction({ admin: req.user, action: "REVIEW_DELETED", targetType: "Review", targetId: review._id });
  sendSuccess(res, { message: "Review deleted" });
});
