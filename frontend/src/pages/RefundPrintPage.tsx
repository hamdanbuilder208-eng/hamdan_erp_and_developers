import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, Refund } from "../types";

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
            <p className="text-lg font-bold text-navy-950">Hamdan Associates</p>
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
            <p className="text-xs text-slate-500">
              {refund.refund_type === "Vendor" ? "Received Into" : "Paid From"}
            </p>
            <p className="mt-0.5 font-medium text-navy-900">{refund.cash_account.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">
              {refund.refund_type === "Customer"
                ? "Revenue Account"
                : refund.refund_type === "Vendor"
                  ? "Vendor / Payable Account"
                  : "Expense Account"}
            </p>
            <p className="mt-0.5 font-medium text-navy-900">{refund.account.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Narration</p>
            <p className="mt-0.5 font-medium text-navy-900">{refund.narration || "—"}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Description</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-2 text-navy-900">Gross Amount</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {Number(refund.gross_amount).toLocaleString()}
              </td>
            </tr>
            {refund.deduction_amount > 0 && (
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 text-navy-900">
                  Deduction {refund.deduction_percent ? `(${refund.deduction_percent}%)` : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-danger-600">
                  −{Number(refund.deduction_amount).toLocaleString()}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
              <td className="px-3 py-2">Net Refund Amount</td>
              <td className="px-3 py-2 text-right tabular-nums">
                PKR {Number(refund.net_amount).toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-16 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Received By</div>
        </div>
      </div>
    </div>
  );
}
