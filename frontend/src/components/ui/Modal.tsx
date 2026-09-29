import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** Opens above any other open modal, centered (used by the confirm dialog). */
  stacked?: boolean;
}

export function Modal({ open, onClose, title, description, children, className, stacked }: ModalProps) {
  // Forms only close through their own buttons (X / Cancel / Submit) — a stray
  // click outside or an Escape press used to wipe a half-filled form. The small
  // stacked confirm dialog holds no input, so it still closes on Escape/outside.
  React.useEffect(() => {
    if (!open || !stacked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Captured and swallowed so it closes only itself, not the modal underneath.
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [open, onClose, stacked]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-16 sm:pt-24",
        stacked && "z-[60] items-center pt-4 sm:pt-4",
      )}
    >
      <div
        className="fixed inset-0 bg-navy-950/50 backdrop-blur-sm"
        onClick={stacked ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative w-full max-w-lg rounded-xl bg-white shadow-2xl ring-1 ring-black/5 animate-in dark:bg-navy-900 dark:ring-white/10",
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 dark:border-navy-800">
          <div>
            <h2 className="text-base font-semibold text-navy-900 dark:text-slate-100">{title}</h2>
            {description && (
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-navy-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
