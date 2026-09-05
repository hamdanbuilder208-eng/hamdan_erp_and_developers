import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, Receipt } from "../types";

const API_ORIGIN = new URL(api.defaults.baseURL ?? "", window.location.origin).origin;
const photoUrl = (path: string | null) => (path ? `${API_ORIGIN}${path}` : null);

const RECEIPT_TERMS = [
  "Payment received is subject to clearance and realization of the payment instrument, where applicable.",
  "Any applicable documentation, utility, development, maintenance, taxes, government charges or other charges shall be payable separately as per the agreed terms.",
  "The payment shall be adjusted against the buyer's outstanding balance/payment schedule.",
  "In case of any discrepancy, the company's official accounts and records shall prevail.",
  "This receipt is valid only when issued and authorized by the company.",
];

export default function ReceiptPrintPage() {
  const { id } = useParams();

  const { data: receipt, isLoading } = useQuery({
    queryKey: ["receipt", id],
    queryFn: async () => (await api.get<Receipt>(`/receipts/${id}`)).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  const { data: history } = useQuery({
    queryKey: ["receipts", "booking", receipt?.booking_id],
    queryFn: async () =>
      (await api.get<Receipt[]>("/receipts/", { params: { booking_id: receipt!.booking_id } })).data,
    enabled: !!receipt,
  });

  if (isLoading || !receipt) {
    return <div className="p-10 text-sm text-slate-400">Loading receipt...</div>;
  }

  const booking = receipt.booking;
  const totalPaid = booking.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0);
  const outstanding = Number(booking.total_price) - totalPaid;
  const nextDue = booking.schedule_lines
    .slice()
    .sort((a, b) => a.installment_no - b.installment_no)
    .find((l) => Number(l.paid_amount) < Number(l.amount));

  const orderedHistory = (history ?? [])
    .slice()
    .sort((a, b) => a.receipt_date.localeCompare(b.receipt_date));

  const facilities = [booking.unit.facility_1, booking.unit.facility_2, booking.unit.facility_3, booking.unit.facility_4]
    .filter(Boolean)
    .join(", ");

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
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">Installment Slip</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{receipt.receipt_no}</p>
            <p className="text-xs text-slate-400">{receipt.receipt_date}</p>
          </div>
        </div>

        <div className="flex gap-4 py-5">
          <div className="grid flex-1 grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Allottee</p>
              <p className="mt-0.5 font-medium text-navy-900">{booking.allottee.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Booking Ref</p>
              <p className="mt-0.5 font-medium text-navy-900">{booking.booking_ref_no}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Project / Unit</p>
              <p className="mt-0.5 font-medium text-navy-900">
                {booking.project.project_name} · {booking.unit.unit_number}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Facilities</p>
              <p className="mt-0.5 font-medium text-navy-900">{facilities || "—"}</p>
            </div>
            {booking.allottee.nominee_name && (
              <div className="col-span-2 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">Nominee</p>
                <p className="mt-0.5 font-medium text-navy-900">
                  {booking.allottee.nominee_name}
                  {booking.allottee.nominee_relation ? ` (${booking.allottee.nominee_relation})` : ""}
                </p>
              </div>
            )}
          </div>

          {(booking.allottee.picture_url || booking.allottee.nominee_picture_url) && (
            <div className="flex shrink-0 gap-3">
              {booking.allottee.picture_url && (
                <div className="text-center">
                  <img
                    src={photoUrl(booking.allottee.picture_url) ?? undefined}
                    alt={booking.allottee.name}
                    className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Allottee</p>
                </div>
              )}
              {booking.allottee.nominee_picture_url && (
                <div className="text-center">
                  <img
                    src={photoUrl(booking.allottee.nominee_picture_url) ?? undefined}
                    alt={booking.allottee.nominee_name ?? "Nominee"}
                    className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Nominee</p>
                </div>
              )}
            </div>
          )}
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
              <span className="text-slate-500">Total Unit Price</span>
              <span className="font-semibold text-navy-950">
                PKR {Number(booking.total_price).toLocaleString()}
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
                <p className="mt-1 font-semibold text-navy-950">{nextDue.label}</p>
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
