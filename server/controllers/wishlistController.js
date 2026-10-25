import User from "../models/User.js";
import Product from "../models/Product.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { badRequest, notFound } from "../utils/ApiError.js";

const isId = (v) => /^[0-9a-fA-F]{24}$/.test(v);

const listView = async (userId) => {
  const user = await User.findById(userId).populate({
    path: "wishlist",
    match: { isActive: true },
    populate: { path: "category", select: "name slug" },
  });
  return user.wishlist.filter(Boolean);
};

// GET /api/wishlist
export const getWishlist = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await listView(req.user._id) });
});

// POST /api/wishlist/:productId
export const addToWishlist = asyncHandler(async (req, res) => {
  if (!isId(req.params.productId)) throw badRequest("Invalid product id");
  const product = await Product.findById(req.params.productId);
  if (!product || !product.isActive) throw notFound("Product not found");

  await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: product._id } });
  sendSuccess(res, { statusCode: 201, message: "Added to wishlist", data: await listView(req.user._id) });
});

// DELETE /api/wishlist/:productId
export const removeFromWishlist = asyncHandler(async (req, res) => {
  if (!isId(req.params.productId)) throw badRequest("Invalid product id");
  await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.productId } });
  sendSuccess(res, { message: "Removed from wishlist", data: await listView(req.user._id) });
});
