import mongoose from "mongoose";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import Product from "../models/Product.js";

// A "verified purchaser" has an order containing the product that was
// actually DELIVERED to them (not merely placed or paid).
export const findQualifyingOrder = (userId, productId) =>
  Order.findOne({ user: userId, "items.product": productId, "shipping.deliveredAt": { $ne: null } }).sort({ "shipping.deliveredAt": -1 });

export const getReviewEligibility = async (userId, productId) => {
  if (await Review.exists({ user: userId, product: productId })) {
    return { canReview: false, hasReviewed: true, reason: "You have already reviewed this product" };
  }
  const order = await findQualifyingOrder(userId, productId);
  if (!order) return { canReview: false, hasReviewed: false, reason: "Only customers who received this product can review it" };
  return { canReview: true, hasReviewed: false, orderId: order._id };
};

// Keeps Product.ratings / reviewCount in step with PUBLISHED reviews.
export const recalcProductRating = async (productId) => {
  const match = { product: new mongoose.Types.ObjectId(String(productId)), status: "PUBLISHED" };
  const [count, [agg]] = await Promise.all([
    Review.countDocuments(match),
    Review.aggregate([{ $match: match }, { $group: { _id: null, sum: { $sum: "$rating" } } }]),
  ]);
  const ratings = count > 0 && agg ? Math.round((agg.sum / count) * 10) / 10 : 0;
  await Product.updateOne({ _id: productId }, { $set: { ratings, reviewCount: count } });
};

// Ratings are derived data: if refreshing them fails, the review itself must
// still succeed (the next review/moderation action recalculates it).
export const refreshProductRating = async (productId) => {
  try {
    await recalcProductRating(productId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Could not refresh rating for product ${productId}:`, err.message);
  }
};
