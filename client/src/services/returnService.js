import api from "./api";

export const previewReturnApi = async (payload) => (await api.post("/returns/preview", payload)).data.data;

export const createReturnApi = async ({ orderId, reason, description, items, images }) => {
  const form = new FormData();
  form.append("orderId", orderId);
  form.append("reason", reason);
  form.append("description", description || "");
  form.append("items", JSON.stringify(items));
  images.forEach((file) => form.append("images", file));
  return (await api.post("/returns", form, { headers: { "Content-Type": "multipart/form-data" } })).data.data;
};

export const listReturnsApi = async () => (await api.get("/returns")).data.data;
export const getReturnApi = async (id) => (await api.get(`/returns/${id}`)).data.data;

// Reviews
export const listReviewsApi = async (productId, params) => (await api.get(`/products/${productId}/reviews`, { params })).data;
export const canReviewApi = async (productId) => (await api.get(`/reviews/can-review/${productId}`)).data.data;
export const createReviewApi = async ({ productId, rating, comment, images }) => {
  const form = new FormData();
  form.append("productId", productId);
  form.append("rating", String(rating));
  form.append("comment", comment || "");
  images.forEach((file) => form.append("images", file));
  return (await api.post("/reviews", form, { headers: { "Content-Type": "multipart/form-data" } })).data.data;
};
export const deleteReviewApi = async (id) => (await api.delete(`/reviews/${id}`)).data;
