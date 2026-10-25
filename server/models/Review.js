import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true }, // the purchase that qualifies the review
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: "" },
    images: [{ url: String, publicId: String, _id: false }],
    status: { type: String, enum: ["PUBLISHED", "HIDDEN"], default: "PUBLISHED", index: true },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, product: 1 }, { unique: true }); // one review per buyer per product

export default mongoose.model("Review", reviewSchema);
