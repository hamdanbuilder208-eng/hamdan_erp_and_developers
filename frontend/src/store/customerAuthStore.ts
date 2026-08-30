import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomerAccount } from "../types";

interface CustomerAuthState {
  token: string | null;
  account: CustomerAccount | null;
  setSession: (token: string, account: CustomerAccount) => void;
  logout: () => void;
}

export const useCustomerAuthStore = create<CustomerAuthState>()(
  persist(
    (set) => ({
      token: null,
      account: null,
      setSession: (token, account) => set({ token, account }),
      logout: () => set({ token: null, account: null }),
    }),
    { name: "hamdan-erp-customer-auth" },
  ),
);
