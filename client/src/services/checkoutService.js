import api from "./api";

export const checkPincodeApi = async (pincode) => (await api.post("/shipping/check", { pincode })).data.data;
export const checkoutSummaryApi = async (payload) => (await api.post("/checkout/summary", payload)).data.data;
export const createOrderApi = async (payload) => (await api.post("/orders", payload)).data.data;
export const listOrdersApi = async (params) => (await api.get("/orders", { params })).data;
export const getOrderApi = async (id) => (await api.get(`/orders/${id}`)).data.data;

export const createPaymentOrderApi = async (orderId) => (await api.post("/payments/create-order", { orderId })).data.data;
export const verifyPaymentApi = async (payload) => (await api.post("/payments/verify", payload)).data.data;
export const reportPaymentFailedApi = async (orderId, reason) =>
  api.post("/payments/failed", { orderId, reason }).catch(() => {});

export const sendCodOtpApi = async (orderId) => (await api.post(`/orders/${orderId}/cod/otp/send`)).data.data;
export const verifyCodOtpApi = async (orderId, code) => (await api.post(`/orders/${orderId}/cod/otp/verify`, { code })).data.data;

export const cancelOrderApi = async (orderId, reason) => (await api.post(`/orders/${orderId}/cancel`, { reason })).data;
