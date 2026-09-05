import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToastStore, type ToastType } from "../../store/toastStore";
import { cn } from "../../lib/utils";

const iconByType: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const styleByType: Record<ToastType, string> = {
  success: "border-success-500/30 bg-success-50 text-success-700 dark:bg-navy-900 dark:text-success-400",
  error: "border-danger-500/30 bg-danger-50 text-danger-700 dark:bg-navy-900 dark:text-danger-400",
  info: "border-info-500/30 bg-info-50 text-info-700 dark:bg-navy-900 dark:text-info-400",
};

const iconStyleByType: Record<ToastType, string> = {
  success: "text-success-500",
  error: "text-danger-500",
  info: "text-info-500",
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = iconByType[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              "animate-in pointer-events-auto flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg ring-1 ring-black/5",
              styleByType[t.type],
            )}
            role="status"
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconStyleByType[t.type])} />
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded-md p-0.5 text-current/60 hover:text-current"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
