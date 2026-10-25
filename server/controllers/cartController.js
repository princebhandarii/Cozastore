import { z } from "zod";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { getVariant, getUnitPrice, getAvailableStock } from "../utils/pricing.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const addSchema = z.object({
  productId: objectId,
  variantId: objectId.nullish(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});
const updateSchema = z.object({ quantity: z.coerce.number().int().min(1).max(20) });

const parse = (schema, body) => {
  const result = schema.safeParse(body);
  if (!result.success) throw badRequest(result.error.issues[0].message, "VALIDATION_ERROR");
  return result.data;
};

const getOrCreateCart = async (userId) =>
  (await Cart.findOne({ user: userId })) || Cart.create({ user: userId, items: [] });

// Builds the response the frontend renders. Every price/stock/availability
// value here is computed from the database at request time.
export const buildCartView = async (cart) => {
  await cart.populate("items.product");
  let subtotal = 0;
  let itemCount = 0;

  const items = cart.items.map((item) => {
    const product = item.product;
    if (!product || !product.isActive) {
      return { _id: item._id, quantity: item.quantity, available: false, reason: "Product is no longer available" };
    }
    const variant = getVariant(product, item.variantId);
    if (item.variantId && !variant) {
      return { _id: item._id, quantity: item.quantity, available: false, reason: "Selected option is no longer available" };
    }
    const stock = getAvailableStock(product, variant);
    const unitPrice = getUnitPrice(product, variant);
    const available = stock >= item.quantity;
    const lineTotal = unitPrice * item.quantity;
    if (available) {
      subtotal += lineTotal;
      itemCount += item.quantity;
    }
    return {
      _id: item._id,
      productId: product._id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      image: variant?.image || product.images?.[0]?.url || null,
      sku: variant?.sku || product.sku,
      variantId: item.variantId,
      size: variant?.size || null,
      color: variant?.color || null,
      quantity: item.quantity,
      unitPrice,
      lineTotal,
      stock,
      available,
      reason: available ? null : stock === 0 ? "Out of stock" : `Only ${stock} left in stock`,
    };
  });

  return { items, subtotal, itemCount };
};

// GET /api/cart
export const getCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  sendSuccess(res, { data: await buildCartView(cart) });
});

// POST /api/cart
export const addToCart = asyncHandler(async (req, res) => {
  const { productId, variantId, quantity } = parse(addSchema, req.body);

  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw notFound("Product not found");

  if (product.variants.length > 0 && !variantId) {
    throw badRequest("Please select a size/color option", "VARIANT_REQUIRED");
  }
  const variant = getVariant(product, variantId);
  if (variantId && !variant) throw badRequest("Selected option does not exist", "INVALID_VARIANT");

  const cart = await getOrCreateCart(req.user._id);
  const existing = cart.items.find(
    (i) => String(i.product) === productId && String(i.variantId || "") === String(variantId || "")
  );
  const newQty = (existing?.quantity || 0) + quantity;

  const stock = getAvailableStock(product, variant);
  if (stock <= 0) throw new ApiError(409, "Product is out of stock", "OUT_OF_STOCK");
  if (newQty > stock) throw new ApiError(409, `Only ${stock} left in stock`, "INSUFFICIENT_STOCK");
  if (newQty > 20) throw badRequest("Maximum 20 units per item", "MAX_QUANTITY");

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: productId, variantId: variantId || null, quantity });

  await cart.save();
  sendSuccess(res, { statusCode: 201, message: "Added to cart", data: await buildCartView(cart) });
});

// PATCH /api/cart/:itemId
export const updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = parse(updateSchema, req.body);
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw notFound("Cart item not found");

  const product = await Product.findById(item.product);
  if (!product || !product.isActive) throw notFound("Product is no longer available");
  const variant = getVariant(product, item.variantId);
  const stock = getAvailableStock(product, variant);
  if (quantity > stock) throw new ApiError(409, `Only ${stock} left in stock`, "INSUFFICIENT_STOCK");

  item.quantity = quantity;
  await cart.save();
  sendSuccess(res, { message: "Cart updated", data: await buildCartView(cart) });
});

// DELETE /api/cart/:itemId
export const removeCartItem = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  const item = cart.items.id(req.params.itemId);
  if (!item) throw notFound("Cart item not found");
  item.deleteOne();
  await cart.save();
  sendSuccess(res, { message: "Item removed", data: await buildCartView(cart) });
});

// DELETE /api/cart
export const clearCart = asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user._id);
  cart.items = [];
  await cart.save();
  sendSuccess(res, { message: "Cart cleared", data: await buildCartView(cart) });
});
