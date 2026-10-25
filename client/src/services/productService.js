import api from "./api";

export const fetchProducts = async (params = {}) => {
  const { data } = await api.get("/products", { params });
  return data; // { success, data: [...], meta: { page, pages, total, limit } }
};

export const fetchProductBySlug = async (slug) => {
  const { data } = await api.get(`/products/${slug}`);
  return data.data;
};

export const fetchCategories = async () => {
  const { data } = await api.get("/categories");
  return data.data;
};
