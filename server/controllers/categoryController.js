import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { ApiError, badRequest, notFound } from "../utils/ApiError.js";
import { generateUniqueSlug } from "../utils/slug.js";
import { uploadBufferToCloudinary, deleteFromCloudinary } from "../services/cloudinary/cloudinaryService.js";

// GET /api/categories (public)
export const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });
  sendSuccess(res, { data: categories });
});

// POST /api/categories (admin)
export const createCategory = asyncHandler(async (req, res) => {
  const { name, description, parent } = req.body;
  if (!name) throw badRequest("Category name is required");

  const slug = await generateUniqueSlug(Category, name);

  let image = null;
  let imagePublicId = null;
  if (req.file) {
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, "cozastore/categories");
    image = uploaded.url;
    imagePublicId = uploaded.publicId;
  }

  const category = await Category.create({
    name,
    slug,
    description,
    parent: parent || null,
    image,
    imagePublicId,
  });

  sendSuccess(res, { statusCode: 201, message: "Category created", data: category });
});

// PATCH /api/categories/:id (admin)
export const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw notFound("Category not found");

  const { name, description, parent, isActive } = req.body;

  if (name && name !== category.name) {
    category.slug = await generateUniqueSlug(Category, name, category._id);
    category.name = name;
  }
  if (description !== undefined) category.description = description;
  if (parent !== undefined) category.parent = parent || null;
  if (isActive !== undefined) category.isActive = isActive;

  if (req.file) {
    if (category.imagePublicId) await deleteFromCloudinary(category.imagePublicId);
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, "cozastore/categories");
    category.image = uploaded.url;
    category.imagePublicId = uploaded.publicId;
  }

  await category.save();
  sendSuccess(res, { message: "Category updated", data: category });
});

// DELETE /api/categories/:id (admin)
export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw notFound("Category not found");

  // Deleting a category that still has products would orphan them.
  const inUse = await Product.countDocuments({ category: category._id });
  if (inUse > 0) throw new ApiError(409, `${inUse} product(s) still use this category. Move or delete them first.`, "CATEGORY_IN_USE");
  if (await Category.exists({ parent: category._id })) throw new ApiError(409, "This category has sub-categories.", "CATEGORY_IN_USE");

  if (category.imagePublicId) await deleteFromCloudinary(category.imagePublicId);
  await category.deleteOne();

  sendSuccess(res, { message: "Category deleted" });
});

// GET /api/categories/admin/all (admin) - includes inactive, with product counts
export const adminListCategories = asyncHandler(async (req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find({}).sort({ name: 1 }),
    Product.aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  sendSuccess(res, { data: categories.map((c) => ({ ...c.toObject(), productCount: byId.get(String(c._id)) || 0 })) });
});
