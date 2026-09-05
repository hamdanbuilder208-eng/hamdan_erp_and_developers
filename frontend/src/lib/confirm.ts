import { useConfirmStore } from "../store/confirmStore";

export function confirm(
  message: string,
  options?: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean },
): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().open({
      title: options?.title ?? "Please confirm",
      message,
      confirmLabel: options?.confirmLabel ?? "Confirm",
      cancelLabel: options?.cancelLabel ?? "Cancel",
      danger: options?.danger ?? false,
      resolve,
    });
  });
}
