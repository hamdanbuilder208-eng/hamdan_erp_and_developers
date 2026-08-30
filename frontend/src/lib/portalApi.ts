import axios from "axios";
import { useCustomerAuthStore } from "../store/customerAuthStore";
import { API_BASE_URL } from "./api";

export const portalApi = axios.create({
  baseURL: API_BASE_URL,
});

portalApi.interceptors.request.use((config) => {
  const token = useCustomerAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useCustomerAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
