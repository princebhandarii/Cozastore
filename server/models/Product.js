import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    size: { type: String, trim: true, default: null },
    color: { type: String, trim: true, default: null },
    sku: { type: String, required: true, trim: true, unique: true, sparse: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    image: { type: String, default: null }, // Cloudinary URL
  },
  { _id: true }
);

const specSchema = new mongoose.Schema(
  { key: { type: String, trim: true }, value: { type: String, trim: true } },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    shortDescription: { type: String, trim: true, maxlength: 300, default: "" },
    brand: { type: String, trim: true, default: "" },

    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },

    // Cloudinary image objects: { url, publicId }. Stored so deletes/replacements
    // can target the exact Cloudinary asset instead of guessing from a URL.
    images: [
      {
        url: { type: String, required: true },
        // null for seeded/demo images that don't live in Cloudinary yet.
        publicId: { type: String, default: null },
      },
    ],

    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0, default: null },
    discount: { type: Number, min: 0, max: 100, default: 0 },

    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, required: true, unique: true, trim: true },

    specifications: [specSchema],
    variants: [variantSchema],

    ratings: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },

    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Supports the search feature: name + brand text search.
productSchema.index({ name: "text", brand: "text" });
// Supports common filter/sort combinations without a full collection scan.
productSchema.index({ category: 1, price: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });

productSchema.virtual("effectivePrice").get(function effectivePrice() {
  if (this.discount > 0) {
    return Math.round(this.price * (1 - this.discount / 100));
  }
  return this.price;
});

productSchema.set("toJSON", { virtuals: true });

export default mongoose.model("Product", productSchema);
