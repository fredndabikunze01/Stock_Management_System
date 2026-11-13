import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

const expectArray = (data, endpoint) => {
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected response from ${endpoint}. Check that the backend API is running.`);
  }
  return data;
};

export const getErrorMessage = (error) =>
  error.response?.data?.message || error.message || "The request could not be completed.";

export const fetchProducts = (search = "") =>
  api.get("/products", { params: search ? { search } : {} }).then(({ data }) => expectArray(data, "/api/products"));
export const fetchProduct = (id) => api.get(`/products/${id}`).then(({ data }) => data);
export const createProduct = (product) => api.post("/products", product).then(({ data }) => data);
export const updateProduct = (id, product) => api.put(`/products/${id}`, product).then(({ data }) => data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);
export const fetchDashboard = () =>
  api.get("/dashboard/summary").then(({ data }) => {
    if (!data || !Array.isArray(data.recentMovements)) {
      throw new Error("Unexpected response from /api/dashboard/summary. Check that the backend API is running.");
    }
    return data;
  });
export const fetchMovements = () =>
  api.get("/stock/movements").then(({ data }) => expectArray(data, "/api/stock/movements"));
export const addStock = (movement) => api.post("/stock/add", movement).then(({ data }) => data);
export const removeStock = (movement) => api.post("/stock/remove", movement).then(({ data }) => data);
