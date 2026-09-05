import axios from "axios";
import { useAuthStore } from "../store/authStore";

// Falls back to whatever host the page was loaded from (localhost when
// browsing on this machine, the LAN IP when a phone opens it over WiFi —
// e.g. scanning a QR code) so the frontend keeps talking to the backend
// on this same machine either way.
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? `http://${window.location.hostname}:8000/api/v1`;

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
