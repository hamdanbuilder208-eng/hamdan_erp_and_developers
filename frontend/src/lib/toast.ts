import { useToastStore } from "../store/toastStore";

export const toast = {
  success: (message: string) => useToastStore.getState().push("success", message),
  error: (message: string) => useToastStore.getState().push("error", message),
  info: (message: string) => useToastStore.getState().push("info", message),
};

export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return message ?? fallback;
}
