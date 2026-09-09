import axios from "axios";
import { useAuthStore } from "../store/authStore";

// Relative by default so every request stays on the page's own origin
// (https://<lan-ip>:5173 when a phone opens it over WiFi, e.g. scanning a QR
// code) — Vite's dev server proxy (see vite.config.ts) forwards it to the
// backend over http server-side. Talking to the backend's http origin
// directly from the browser gets silently blocked as mixed content once the
// page itself is https.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
