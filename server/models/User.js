import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phone: {
      type: String,
      required: true,
      match: [/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number"],
    },
    addressLine1: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    addressLine2: { type: String, trim: true, maxlength: 120, default: "" },
    landmark: { type: String, trim: true, maxlength: 120, default: "" },
    city: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    state: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    pincode: {
      type: String,
      required: true,
      match: [/^\d{6}$/, "Enter a valid 6-digit PIN code"],
    },
    addressType: {
      type: String,
      enum: ["Home", "Work", "Other"],
      default: "Home",
    },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    // Firebase Authentication is the source of truth for identity/login.
    // MongoDB only stores the application profile - never a password.
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String, trim: true, maxlength: 80, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: {
      type: String,
      trim: true,
      match: [/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number"],
      default: null,
    },
    profileImage: { type: String, default: null },

    // Role is only ever set/changed from the backend (admin actions),
    // never accepted verbatim from a client request body.
    role: { type: String, enum: ["customer", "admin"], default: "customer" },

    addresses: [addressSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

export default mongoose.model("User", userSchema);
