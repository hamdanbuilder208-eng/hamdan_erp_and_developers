import { AlertTriangle } from "lucide-react";
import { useConfirmStore } from "../../store/confirmStore";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const settle = useConfirmStore((s) => s.settle);

  return (
    <Modal open={!!request} onClose={() => settle(false)} title={request?.title ?? ""}>
      {request && (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            {request.danger && (
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-500 dark:bg-danger-500/10">
                <AlertTriangle className="h-4 w-4" />
              </span>
            )}
            <p className="text-sm text-slate-600 dark:text-slate-300">{request.message}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => settle(false)}>
              {request.cancelLabel}
            </Button>
            <Button variant={request.danger ? "danger" : "primary"} onClick={() => settle(true)}>
              {request.confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
