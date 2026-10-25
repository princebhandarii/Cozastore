import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

let configured = false;

const ensureConfigured = () => {
  if (configured) return;
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new ApiError(
      500,
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env.",
      "CLOUDINARY_NOT_CONFIGURED"
    );
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  configured = true;
};

// Uploads a single in-memory file buffer (from multer) straight to
// Cloudinary. Returns { url, publicId } - callers store both so a later
// delete/replace can target the exact asset instead of guessing from a URL.
export const uploadBufferToCloudinary = (buffer, folder = "cozastore/products") => {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  ensureConfigured();
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
};
