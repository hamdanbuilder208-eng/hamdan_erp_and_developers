import * as React from "react";
import QrScanner from "qr-scanner";
import QrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import { ScanLine } from "lucide-react";
import { Modal } from "./Modal";

QrScanner.WORKER_PATH = QrScannerWorkerPath;

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  onScan: (text: string) => void;
}

export function QrScannerModal({
  open,
  onClose,
  title = "Scan QR Code",
  description = "Point the camera at the material's QR code.",
  onScan,
}: QrScannerModalProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const scannerRef = React.useRef<QrScanner | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !videoRef.current) return;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "This browser can't access the camera here — the page isn't loaded over a secure " +
          "connection (https). Reload using the https:// link.",
      );
      return;
    }

    let cancelled = false;
    let scanner: QrScanner | null = null;

    const friendlyMessage = (err: unknown) => {
      const name = err instanceof Error ? err.name : "";
      const detail = err instanceof Error ? err.message : String(err);
      return name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access for this site in your browser settings and reload."
        : name === "NotFoundError"
          ? "No camera was found on this device."
          : name === "NotReadableError"
            ? "The camera is already in use by another app. Close it and try again."
            : name === "OverconstrainedError"
              ? "This device's camera doesn't support the requested mode."
              : `Couldn't access the camera (${detail || "unknown error"}).`;
    };

    // Ask for the camera directly first — on some mobile browsers,
    // qr-scanner's own device enumeration comes back empty until a
    // getUserMedia call has actually been granted at least once, which it
    // then misreports as "camera not found" instead of "not yet permitted."
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((warmupStream) => {
        warmupStream.getTracks().forEach((t) => t.stop());
        if (cancelled || !videoRef.current) return;

        scanner = new QrScanner(
          videoRef.current,
          (result) => {
            const text = typeof result === "string" ? result : result.data;
            onScan(text);
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            preferredCamera: "environment",
          },
        );
        scannerRef.current = scanner;
        return scanner.start();
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error("QR scanner camera start failed:", err);
        setError(friendlyMessage(err));
      });

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
      scannerRef.current = null;
    };
  }, [open, onScan]);

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-3">
        {error ? (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
        ) : (
          <div className="relative overflow-hidden rounded-lg bg-navy-950">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <ScanLine className="h-8 w-8 text-white/40" />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
