import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, RentReceipt } from "../types";

const RECEIPT_TERMS = [
  "Payment received is subject to clearance and realization of the payment instrument, where applicable.",
  "This receipt is issued against the monthly rent schedule of the agreement referenced above.",
  "In case of any discrepancy, the company's official accounts and records shall prevail.",
  "This receipt is valid only when issued and authorized by the company.",
];

export default function RentReceiptPrintPage() {
  const { id } = useParams();

  const { data: receipt, isLoading } = useQuery({
    queryKey: ["rent-receipt", id],
    queryFn: async () => (await api.get<RentReceipt>(`/rentals/receipts/${id}`)).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  const { data: history } = useQuery({
    queryKey: ["rentals", "receipts", receipt?.agreement_id],
    queryFn: async () =>
      (await api.get<RentReceipt[]>("/rentals/receipts", { params: { agreement_id: receipt!.agreement_id } }))
        .data,
    enabled: !!receipt,
  });

  if (isLoading || !receipt) {
    return <div className="p-10 text-sm text-slate-400">Loading receipt...</div>;
  }

  const agreement = receipt.agreement;
  const totalPaid = agreement.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0);
  const totalDue = agreement.schedule_lines.reduce((s, l) => s + Number(l.amount), 0);
  const outstanding = totalDue - totalPaid;
  const nextDue = agreement.schedule_lines
    .slice()
    .sort((a, b) => a.month_no - b.month_no)
    .find((l) => Number(l.paid_amount) < Number(l.amount));

  const orderedHistory = (history ?? [])
    .slice()
    .sort((a, b) => a.receipt_date.localeCompare(b.receipt_date));

  const propertyLabel = agreement.unit
    ? agreement.unit.unit_number
    : agreement.land_property
      ? `${agreement.land_property.property_ref_no} · ${agreement.land_property.area_location}`
      : "—";

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
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">Rent Receipt</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{receipt.receipt_no}</p>
            <p className="text-xs text-slate-400">{receipt.receipt_date}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">Tenant</p>
            <p className="mt-0.5 font-medium text-navy-900">{agreement.tenant.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Agreement Ref</p>
            <p className="mt-0.5 font-medium text-navy-900">{agreement.agreement_no}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Property</p>
            <p className="mt-0.5 font-medium text-navy-900">{propertyLabel}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Mode of Payment</p>
            <p className="mt-0.5 font-medium text-navy-900">{receipt.mode_of_payment}</p>
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment History</p>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Receipt #</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Mode</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
            </tr>
          </thead>
          <tbody>
            {orderedHistory.map((r) => (
              <tr
                key={r.id}
                className={`border-b border-slate-100 ${r.id === receipt.id ? "bg-brand-50" : ""}`}
              >
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.receipt_no}</td>
                <td className="px-3 py-2 text-navy-900">{r.receipt_date}</td>
                <td className="px-3 py-2 text-slate-500">{r.mode_of_payment}</td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900">
                  {Number(r.amount).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">This Receipt Amount</span>
              <span className="font-semibold text-navy-950">
                PKR {Number(receipt.amount).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Paid To-Date</span>
              <span className="font-semibold text-navy-950">PKR {totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-500">Monthly Rent</span>
              <span className="font-semibold text-navy-950">
                PKR {Number(agreement.monthly_rent).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Outstanding Balance</span>
              <span className="font-semibold text-danger-600">PKR {outstanding.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4 text-sm">
            <p className="text-slate-500">Next Due</p>
            {nextDue ? (
              <>
                <p className="mt-1 font-semibold text-navy-950">Month {nextDue.month_no}</p>
                <p className="text-slate-600">{nextDue.due_date}</p>
                <p className="mt-2 text-lg font-bold text-navy-950">
                  PKR {(Number(nextDue.amount) - Number(nextDue.paid_amount)).toLocaleString()}
                </p>
              </>
            ) : (
              <p className="mt-1 font-semibold text-success-700">Fully Paid</p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            {RECEIPT_TERMS.map((term, i) => (
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
