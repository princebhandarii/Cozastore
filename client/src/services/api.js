import axios from "axios";
import { getIdToken } from "../firebase/config";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach the current Firebase ID token to every outgoing request.
// The backend re-verifies this token on every protected route -
// the frontend never gets to assert who it is on its own.
api.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize error responses so components can rely on err.message + err.code
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message || error.message || "Something went wrong";
    const code = error.response?.data?.code || "UNKNOWN_ERROR";
    return Promise.reject({ message, code, status: error.response?.status });
  }
);

export default api;
