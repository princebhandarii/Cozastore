import User from "../models/User.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { sendSuccess } from "../utils/ApiResponse.js";
import { notFound, badRequest } from "../utils/ApiError.js";

// GET /api/users/me
export const getMe = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: req.user.toSafeJSON() });
});

// PATCH /api/users/me
// Only a small, explicit allow-list of fields can be self-edited.
// role, firebaseUid, email, isActive are never editable from here.
export const updateMe = asyncHandler(async (req, res) => {
  const allowed = ["name", "phone", "profileImage"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    returnDocument: "after",
    runValidators: true,
  });

  sendSuccess(res, { message: "Profile updated", data: user.toSafeJSON() });
});

// GET /api/users/addresses
export const listAddresses = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: req.user.addresses });
});

// POST /api/users/addresses
export const addAddress = asyncHandler(async (req, res) => {
  const {
    fullName,
    phone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    pincode,
    addressType,
  } = req.body;

  if (!fullName || !phone || !addressLine1 || !city || !state || !pincode) {
    throw badRequest("Missing required address fields");
  }

  const user = await User.findById(req.user._id);
  const isFirstAddress = user.addresses.length === 0;

  user.addresses.push({
    fullName,
    phone,
    addressLine1,
    addressLine2,
    landmark,
    city,
    state,
    pincode,
    addressType,
    isDefault: isFirstAddress, // first saved address becomes the default
  });

  await user.save();
  sendSuccess(res, {
    statusCode: 201,
    message: "Address added",
    data: user.addresses,
  });
});

// PATCH /api/users/addresses/:id
export const updateAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.id);
  if (!address) throw notFound("Address not found");

  const allowed = [
    "fullName",
    "phone",
    "addressLine1",
    "addressLine2",
    "landmark",
    "city",
    "state",
    "pincode",
    "addressType",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) address[key] = req.body[key];
  }

  await user.save();
  sendSuccess(res, { message: "Address updated", data: user.addresses });
});

// DELETE /api/users/addresses/:id
export const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.id);
  if (!address) throw notFound("Address not found");

  address.deleteOne();

  // If we just removed the default address, promote another one so
  // checkout (a later phase) always has a sane default to fall back to.
  if (!user.addresses.some((a) => a.isDefault) && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();
  sendSuccess(res, { message: "Address removed", data: user.addresses });
});
