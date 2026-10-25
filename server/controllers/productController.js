import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { badRequest, notFound } from "../utils/ApiError.js";
import { generateUniqueSlug } from "../utils/slug.js";
import { uploadBufferToCloudinary, deleteFromCloudinary } from "../services/cloudinary/cloudinaryService.js";

const SORT_MAP = {
  newest: { createdAt: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  rating: { ratings: -1 },
  popular: { reviewCount: -1 },
};

// GET /api/products (public)
// Supports: q (search), category (slug or id), brand, minPrice, maxPrice,
// minRating, inStock, sort, page, limit.
// Filtering/sorting/pagination all happen in the DB query - the entire
// catalog is never loaded into the browser.
export const listProducts = asyncHandler(async (req, res) => {
  const {
    q,
    category,
    brand,
    minPrice,
    maxPrice,
    minRating,
    inStock,
    sort = "newest",
    page = 1,
    limit = 12,
  } = req.query;

  const filter = { isActive: true };

  if (q) filter.$text = { $search: q };
  if (brand) filter.brand = new RegExp(`^${brand}$`, "i");
  if (minRating) filter.ratings = { $gte: Number(minRating) };
  // Products with variants are in stock when ANY variant is; simple products use `stock`.
  if (inStock === "true") {
    filter.$or = [
      { "variants.0": { $exists: false }, stock: { $gt: 0 } },
      { variants: { $elemMatch: { stock: { $gt: 0 } } } },
    ];
  }

  if (category) {
    const cat = category.match(/^[0-9a-fA-F]{24}$/)
      ? await Category.findById(category)
      : await Category.findOne({ slug: category });
    if (cat) filter.category = cat._id;
    else return sendSuccess(res, { data: [], meta: { page: 1, pages: 0, total: 0 } });
  }

  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(60, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("category", "name slug")
      .sort(SORT_MAP[sort] || SORT_MAP.newest)
      .skip(skip)
      .limit(limitNum),
    Product.countDocuments(filter),
  ]);

  sendSuccess(res, {
    data: items,
    meta: { page: pageNum, pages: Math.ceil(total / limitNum), total, limit: limitNum },
  });
});

// GET /api/products/:slug (public)
export const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).populate(
    "category",
    "name slug"
  );
  if (!product) throw notFound("Product not found");
  sendSuccess(res, { data: product });
});

const parseJSONField = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    throw badRequest("Invalid JSON in request body for variants/specifications");
  }
};

// POST /api/products (admin) - multipart/form-data, images[] + JSON fields
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    shortDescription,
    brand,
    category,
    price,
    compareAtPrice,
    discount,
    stock,
    sku,
    isFeatured,
  } = req.body;

  if (!name || !description || !category || !price || !sku) {
    throw badRequest("name, description, category, price and sku are required");
  }

  const categoryDoc = await Category.findById(category);
  if (!categoryDoc) throw badRequest("Invalid category");

  const variants = parseJSONField(req.body.variants, []);
  const specifications = parseJSONField(req.body.specifications, []);

  const slug = await generateUniqueSlug(Product, name);

  const images = [];
  if (req.files?.length) {
    for (const file of req.files) {
      const uploaded = await uploadBufferToCloudinary(file.buffer, "cozastore/products");
      images.push(uploaded);
    }
  }

  const product = await Product.create({
    name,
    slug,
    description,
    shortDescription,
    brand,
    category,
    images,
    price: Number(price),
    compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
    discount: discount ? Number(discount) : 0,
    stock: Number(stock) || 0,
    sku,
    specifications,
    variants,
    isFeatured: isFeatured === "true" || isFeatured === true,
  });

  sendSuccess(res, { statusCode: 201, message: "Product created", data: product });
});

// PATCH /api/products/:id (admin)
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound("Product not found");

  const editable = [
    "description",
    "shortDescription",
    "brand",
    "price",
    "compareAtPrice",
    "discount",
    "stock",
    "sku",
    "isFeatured",
    "isActive",
  ];
  for (const key of editable) {
    if (req.body[key] === undefined) continue;
    // The admin form sends "" for blank optional numbers.
    if (key === "discount" && req.body[key] === "") product[key] = 0;
    else if (key === "compareAtPrice" && req.body[key] === "") product[key] = null;
    else product[key] = req.body[key];
  }

  if (req.body.category) {
    const categoryDoc = await Category.findById(req.body.category);
    if (!categoryDoc) throw badRequest("Invalid category");
    product.category = req.body.category;
  }

  if (req.body.name && req.body.name !== product.name) {
    product.slug = await generateUniqueSlug(Product, req.body.name, product._id);
    product.name = req.body.name;
  }

  if (req.body.variants !== undefined) {
    product.variants = parseJSONField(req.body.variants, product.variants);
  }
  if (req.body.specifications !== undefined) {
    product.specifications = parseJSONField(req.body.specifications, product.specifications);
  }

  // New images are appended; removing specific images is handled by
  // passing removeImagePublicIds (array of Cloudinary publicIds to drop).
  const removeUrls = parseJSONField(req.body.removeImageUrls, []);
  if (removeUrls.length) {
    for (const img of product.images.filter((i) => removeUrls.includes(i.url))) await deleteFromCloudinary(img.publicId);
    product.images = product.images.filter((i) => !removeUrls.includes(i.url));
  }
  const removeIds = parseJSONField(req.body.removeImagePublicIds, []);
  if (removeIds.length) {
    for (const publicId of removeIds) await deleteFromCloudinary(publicId);
    product.images = product.images.filter((img) => !removeIds.includes(img.publicId));
  }

  if (req.files?.length) {
    for (const file of req.files) {
      const uploaded = await uploadBufferToCloudinary(file.buffer, "cozastore/products");
      product.images.push(uploaded);
    }
  }

  await product.save();
  sendSuccess(res, { message: "Product updated", data: product });
});

// DELETE /api/products/:id (admin)
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw notFound("Product not found");

  for (const img of product.images) {
    await deleteFromCloudinary(img.publicId);
  }
  await product.deleteOne();

  sendSuccess(res, { message: "Product deleted" });
});

// GET /api/products/admin/all (admin) - unfiltered by isActive, for the admin table
export const adminListProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));

  const [items, total] = await Promise.all([
    Product.find({})
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Product.countDocuments({}),
  ]);

  sendSuccess(res, {
    data: items,
    meta: { page: pageNum, pages: Math.ceil(total / limitNum), total },
  });
});

// GET /api/products/admin/:id (admin) - includes inactive products, for the edit form
export const adminGetProduct = asyncHandler(async (req, res) => {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) throw notFound("Product not found");
  const product = await Product.findById(req.params.id).populate("category", "name slug");
  if (!product) throw notFound("Product not found");
  sendSuccess(res, { data: product });
});
