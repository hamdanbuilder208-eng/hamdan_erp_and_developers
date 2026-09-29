import { Input, Label } from "../ui/Input";

/** Cheque / bank-transfer details, shared by every form that records a
 * payment mode (booking receipts, rent receipts, land/plot payments). The
 * backend checks the same rules (app/core/payment_details.py). */
export type PaymentDetails = {
  cheque_no: string;
  cheque_bank_name: string;
  transfer_bank_name: string;
  transfer_account_title: string;
  transfer_account_no: string;
  transfer_ref_no: string;
  transfer_to_account_title: string;
  transfer_to_account_no: string;
};

export const emptyPaymentDetails = (): PaymentDetails => ({
  cheque_no: "",
  cheque_bank_name: "",
  transfer_bank_name: "",
  transfer_account_title: "",
  transfer_account_no: "",
  transfer_ref_no: "",
  transfer_to_account_title: "",
  transfer_to_account_no: "",
});

const transferModes = ["Bank Transfer", "Online"];
export const isTransferMode = (mode: string) => transferModes.includes(mode);

type PaymentDetailsRecord = { [K in keyof PaymentDetails]?: string | null };

/** Existing record → form values (for edit forms). */
export function paymentDetailsFromRecord(r: PaymentDetailsRecord): PaymentDetails {
  const out = emptyPaymentDetails();
  (Object.keys(out) as (keyof PaymentDetails)[]).forEach((k) => {
    out[k] = r[k] ?? "";
  });
  return out;
}

/** Form values → API payload: only the fields that belong to `mode`, the rest null. */
export function paymentDetailsPayload(mode: string, d: PaymentDetails) {
  const cheque = mode === "Cheque";
  const transfer = isTransferMode(mode);
  const v = (s: string, on: boolean) => (on && s.trim() ? s.trim() : null);
  return {
    cheque_no: v(d.cheque_no, cheque),
    cheque_bank_name: v(d.cheque_bank_name, cheque),
    transfer_bank_name: v(d.transfer_bank_name, transfer),
    transfer_account_title: v(d.transfer_account_title, transfer),
    transfer_account_no: v(d.transfer_account_no, transfer),
    transfer_ref_no: v(d.transfer_ref_no, transfer),
    transfer_to_account_title: v(d.transfer_to_account_title, transfer),
    transfer_to_account_no: v(d.transfer_to_account_no, transfer),
  };
}

/** One-line summary for lists and prints, e.g. "Cheque #000123 · HBL". */
export function paymentDetailsSummary(mode: string, r: PaymentDetailsRecord): string {
  if (mode === "Cheque") {
    return [r.cheque_no && `Cheque #${r.cheque_no}`, r.cheque_bank_name].filter(Boolean).join(" · ");
  }
  if (isTransferMode(mode)) {
    const from = [r.transfer_account_title, r.transfer_account_no].filter(Boolean).join(" ");
    const to = [r.transfer_to_account_title, r.transfer_to_account_no].filter(Boolean).join(" ");
    return [
      from && `From ${from}${r.transfer_bank_name ? ` (${r.transfer_bank_name})` : ""}`,
      to && `To ${to}`,
      r.transfer_ref_no && `Ref ${r.transfer_ref_no}`,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

export function PaymentDetailsFields({
  mode,
  value,
  onChange,
  idPrefix = "pd",
  showChequeNo = true,
}: {
  mode: string;
  value: PaymentDetails;
  onChange: (patch: Partial<PaymentDetails>) => void;
  idPrefix?: string;
  /** Receipts render the cheque number in their own cheque block. */
  showChequeNo?: boolean;
}) {
  const field = (key: keyof PaymentDetails, label: string, required = false, placeholder?: string) => (
    <div>
      <Label htmlFor={`${idPrefix}_${key}`}>{label}</Label>
      <Input
        id={`${idPrefix}_${key}`}
        required={required}
        value={value[key]}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  );

  if (mode === "Cheque") {
    return (
      <div className="grid grid-cols-2 gap-4">
        {showChequeNo && field("cheque_no", "Cheque No.", true)}
        {field("cheque_bank_name", "Bank Name", true, "e.g. HBL")}
      </div>
    );
  }

  if (isTransferMode(mode)) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-navy-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          From (sender's account)
        </p>
        <div className="grid grid-cols-2 gap-4">
          {field("transfer_account_title", "Account Name", true, "Name on the account")}
          {field("transfer_account_no", "Account No. / IBAN", true)}
          {field("transfer_bank_name", "Bank Name (optional)", false, "e.g. Meezan Bank")}
          {field("transfer_ref_no", "Transaction / Ref No. (optional)")}
        </div>
        <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          To (receiver's account)
        </p>
        <div className="grid grid-cols-2 gap-4">
          {field("transfer_to_account_title", "Account Name", true)}
          {field("transfer_to_account_no", "Account No. / IBAN", true)}
        </div>
      </div>
    );
  }

  return null;
}
