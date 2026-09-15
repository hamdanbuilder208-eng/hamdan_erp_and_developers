import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, Refund } from "../types";

const REFUND_TERMS = [
  "This refund has been processed against the amount originally received/paid and is recorded in the company's official books.",
  "Any deduction shown above has been applied as per the applicable policy/agreement.",
  "This voucher is valid only when signed by the preparer and an authorized signatory.",
  "Once processed, this refund cannot be reversed except through a fresh, separately authorized transaction.",
  "In case of any discrepancy, the company's official accounts and records shall prevail.",
];

export default function RefundPrintPage() {
  const { id } = useParams();

  const { data: refund, isLoading } = useQuery({
    queryKey: ["refund", id],
    queryFn: async () => (await api.get<Refund>(`/refunds/${id}`)).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (isLoading || !refund) {
    return <div className="p-10 text-sm text-slate-400">Loading refund...</div>;
  }

  if (refund.status === "Pending") {
    return (
      <div className="p-10 text-sm text-slate-500">
        Refund {refund.refund_no} hasn't had any payment recorded yet — record one from the Refunds tab
        before printing a voucher.
      </div>
    );
  }

  const paidSoFar = refund.payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = Number(refund.net_amount) - paidSoFar;

  const partyLabel =
    refund.refund_type === "Customer"
      ? refund.booking
        ? `${refund.booking.allottee.name} (${refund.booking.booking_ref_no})`
        : "—"
      : refund.party_name || "—";

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="mx-auto w-full max-w-[210mm] bg-white p-10 shadow-sm print:shadow-none print:p-6">
        <div className="flex items-start justify-between border-b border-slate-200 pb-5">
          <div>
            <p className="text-lg font-bold text-navy-950">
              {companySettings?.company_name ?? "Hamdan Builders and Developers"}
            </p>
            <p className="text-xs text-slate-500">Real Estate Builder &amp; Developer</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">
              {refund.refund_type} Refund Voucher
            </p>
            <p className="mt-1 font-mono text-sm text-slate-500">{refund.refund_no}</p>
            <p className="text-xs text-slate-400">{refund.refund_date}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">
              {refund.refund_type === "Customer" ? "Allottee / Booking" : refund.refund_type === "Vendor" ? "Vendor" : "Employee"}
            </p>
            <p className="mt-0.5 font-medium text-navy-900">{partyLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Narration</p>
            <p className="mt-0.5 font-medium text-navy-900">{refund.narration || "—"}</p>
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Payment History
        </p>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
              <th className="px-3 py-2 font-semibold text-slate-600">
                {refund.refund_type === "Vendor" ? "Received Into" : "Paid From"}
              </th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            {refund.payments.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-navy-900">{p.payment_date}</td>
                <td className="px-3 py-2 text-slate-500">{p.cash_account.name}</td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900">
                  {Number(p.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Amount</span>
              <span className="font-semibold text-navy-950">
                PKR {Number(refund.gross_amount).toLocaleString()}
              </span>
            </div>
            {refund.deduction_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">
                  Deduction {refund.deduction_percent ? `(${refund.deduction_percent}%)` : ""}
                </span>
                <span className="font-semibold text-danger-600">
                  −{Number(refund.deduction_amount).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-500">Net Refund Amount</span>
              <span className="font-semibold text-navy-950">
                PKR {Number(refund.net_amount).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Paid To-Date</span>
              <span className="font-semibold text-success-700">PKR {paidSoFar.toLocaleString()}</span>
            </div>
            {outstanding > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500">Outstanding</span>
                <span className="font-semibold text-danger-600">PKR {outstanding.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            {REFUND_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Received By</div>
        </div>
      </div>
    </div>
  );
}
