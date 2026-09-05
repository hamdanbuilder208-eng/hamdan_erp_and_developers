import * as React from "react";
import QRCode from "qrcode";

export function QrImage({ url, size = 260 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: size, margin: 1 }).then((result) => {
      if (!cancelled) setDataUrl(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ height: size, width: size }}
        className="mx-auto flex items-center justify-center text-xs text-slate-400 dark:text-slate-500"
      >
        Generating QR...
      </div>
    );
  }
  return (
    <img
      src={dataUrl}
      alt="QR code"
      style={{ height: size, width: size }}
      className="mx-auto"
    />
  );
}
