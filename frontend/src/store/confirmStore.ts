import { create } from "zustand";

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: (value: boolean) => void;
}

interface ConfirmState {
  request: ConfirmRequest | null;
  open: (request: ConfirmRequest) => void;
  settle: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  request: null,
  open: (request) => set({ request }),
  settle: (value) => {
    get().request?.resolve(value);
    set({ request: null });
  },
}));
