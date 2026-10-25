import api from "./api";

export const getAdminSettingsApi = async () => (await api.get("/admin/settings")).data.data;
export const updateCodSettingsApi = async (payload) => (await api.patch("/admin/settings/cod", payload)).data.data;
export const listAdminOrdersApi = async (params) => (await api.get("/admin/orders", { params })).data;
export const confirmCodApi = async (id) => (await api.patch(`/admin/cod/${id}/confirm`)).data.data;
export const rejectCodApi = async (id, body) => (await api.patch(`/admin/cod/${id}/reject`, body)).data;

export const adminGetOrderApi = async (id) => (await api.get(`/admin/orders/${id}`)).data.data;
export const updateOrderStatusApi = async (id, body) => (await api.patch(`/admin/orders/${id}/status`, body)).data.data;
export const adminCancelOrderApi = async (id, body) => (await api.post(`/admin/orders/${id}/cancel`, body)).data;
export const adminRefundApi = async (id, body) => (await api.post(`/admin/orders/${id}/refund`, body)).data;
export const keepTokenApi = async (id) => (await api.post(`/admin/orders/${id}/keep-token`)).data;
export const updateOrderRulesApi = async (body) => (await api.patch("/admin/settings/orders", body)).data.data;

export const listAdminReturnsApi = async (params) => (await api.get("/admin/returns", { params })).data;
export const adminGetReturnApi = async (id) => (await api.get(`/admin/returns/${id}`)).data.data;
export const updateReturnApi = async (id, body) => (await api.patch(`/admin/returns/${id}`, body)).data.data;
export const retryReturnRefundApi = async (id) => (await api.post(`/admin/returns/${id}/retry-refund`)).data;
export const manualReturnRefundApi = async (id, reference) => (await api.post(`/admin/returns/${id}/manual-refund`, { reference })).data.data;
export const updateReturnRulesApi = async (body) => (await api.patch("/admin/settings/returns", body)).data.data;

export const listAdminReviewsApi = async (params) => (await api.get("/admin/reviews", { params })).data;
export const setReviewStatusApi = async (id, status) => (await api.patch(`/admin/reviews/${id}`, { status })).data.data;
export const adminDeleteReviewApi = async (id) => (await api.delete(`/admin/reviews/${id}`)).data;

export const getDashboardApi = async () => (await api.get("/admin/dashboard")).data.data;
export const getAnalyticsApi = async (days) => (await api.get("/admin/analytics", { params: { days } })).data.data;
export const listUsersApi = async (params) => (await api.get("/admin/users", { params })).data;
export const setUserStatusApi = async (id, isActive) => (await api.patch(`/admin/users/${id}/status`, { isActive })).data;
export const listPaymentsApi = async (params) => (await api.get("/admin/payments", { params })).data;
export const updateShippingSettingsApi = async (body) => (await api.patch("/admin/settings/shipping", body)).data.data;

// Products / categories / coupons / inventory
export const adminListProductsApi = async (params) => (await api.get("/products/admin/all", { params })).data;
export const adminGetProductApi = async (id) => (await api.get(`/products/admin/${id}`)).data.data;
export const saveProductApi = async (id, form) =>
  (await (id ? api.patch(`/products/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } }) : api.post("/products", form, { headers: { "Content-Type": "multipart/form-data" } }))).data.data;
export const deleteProductApi = async (id) => (await api.delete(`/products/${id}`)).data;

export const adminListCategoriesApi = async () => (await api.get("/categories/admin/all")).data.data;
export const saveCategoryApi = async (id, form) =>
  (await (id ? api.patch(`/categories/${id}`, form, { headers: { "Content-Type": "multipart/form-data" } }) : api.post("/categories", form, { headers: { "Content-Type": "multipart/form-data" } }))).data.data;
export const deleteCategoryApi = async (id) => (await api.delete(`/categories/${id}`)).data;

export const listCouponsApi = async () => (await api.get("/coupons")).data.data;
export const saveCouponApi = async (id, body) => (await (id ? api.patch(`/coupons/${id}`, body) : api.post("/coupons", body))).data.data;
export const deleteCouponApi = async (id) => (await api.delete(`/coupons/${id}`)).data;

export const lowStockApi = async (threshold) => (await api.get("/admin/inventory", { params: { threshold } })).data;
export const inventoryLogsApi = async (params) => (await api.get("/admin/inventory/logs", { params })).data;
export const adjustInventoryApi = async (body) => (await api.post("/admin/inventory/adjust", body)).data.data;
