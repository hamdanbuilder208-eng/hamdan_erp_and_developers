import type { CompanySettings } from "../../types";

export function AccountantSignature({ settings }: { settings: CompanySettings | undefined }) {
  return (
    <div className="border-t border-slate-300 pt-2">
      {settings?.signature_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.signature_image_url}
          alt="Signature"
          className="mx-auto mb-1 h-10 object-contain"
        />
      )}
      {settings?.accountant_name ? (
        <>
          <p className="font-medium text-navy-900">{settings.accountant_name}</p>
          {settings.accountant_designation && (
            <p className="text-[10px] text-slate-400">{settings.accountant_designation}</p>
          )}
        </>
      ) : (
        "Accountant"
      )}
    </div>
  );
}
