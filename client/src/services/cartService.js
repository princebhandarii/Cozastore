import api from "./api";

export const getCartApi = async () => (await api.get("/cart")).data.data;
export const addToCartApi = async (payload) => (await api.post("/cart", payload)).data.data;
export const updateCartItemApi = async (itemId, quantity) =>
  (await api.patch(`/cart/${itemId}`, { quantity })).data.data;
export const removeCartItemApi = async (itemId) => (await api.delete(`/cart/${itemId}`)).data.data;
export const clearCartApi = async () => (await api.delete("/cart")).data.data;

export const getWishlistApi = async () => (await api.get("/wishlist")).data.data;
export const addToWishlistApi = async (productId) => (await api.post(`/wishlist/${productId}`)).data.data;
export const removeFromWishlistApi = async (productId) => (await api.delete(`/wishlist/${productId}`)).data.data;

// Only the code is sent; the server computes subtotal and discount.
export const validateCouponApi = async (code) => (await api.post("/coupons/validate", { code })).data.data;
