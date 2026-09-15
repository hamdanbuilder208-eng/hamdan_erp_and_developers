import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { Booking, CompanySettings } from "../types";

const API_ORIGIN = new URL(api.defaults.baseURL ?? "", window.location.origin).origin;
const photoUrl = (path: string | null) => (path ? `${API_ORIGIN}${path}` : null);

const INVOICE_TERMS = [
  "Payments must follow the agreed schedule; late payments may attract charges.",
  "Documentation, utility, development, maintenance and government charges are payable separately.",
  "Cheque/pay order payments are valid only upon clearance.",
  "Discounts/concessions are valid only if approved in writing by the company.",
  "Continued default may result in cancellation/adjustment of the booking, per the agreement.",
  "Report any discrepancy within 7 days of receipt, or the invoice is deemed accepted.",
  "All installments are due before the 10th of each month.",
  "On cancellation, 75% of the amount paid is refundable; 25% is retained as cancellation/admin charges.",
  "Extra charges are payable within 90 days of booking.",
  "Governed by the company's official accounts/records, read together with the Booking/Allotment Agreement.",
];

export default function InvoicePrintPage() {
  const { bookingId, lineId } = useParams();

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: async () => (await api.get<Booking>(`/bookings/${bookingId}`)).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (isLoading || !booking) {
    return <div className="p-10 text-sm text-slate-400">Loading invoice...</div>;
  }

  const line = booking.schedule_lines.find((l) => l.id === Number(lineId));
  if (!line) {
    return <div className="p-10 text-sm text-danger-600">Installment not found on this booking.</div>;
  }

  const balance = Number(line.amount) - Number(line.paid_amount);
  const totalPaid = booking.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0);
  const outstanding = Number(booking.total_price) - totalPaid;
  const invoiceNo = `INV-${booking.booking_ref_no}-${String(line.installment_no).padStart(3, "0")}`;
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
            <p className="text-lg font-bold text-navy-950">
              {companySettings?.company_name ?? "Hamdan Builders and Developers"}
            </p>
            <p className="text-xs text-slate-500">Real Estate Builder &amp; Developer</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">Invoice</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{invoiceNo}</p>
            <p className="text-xs text-slate-400">{new Date().toISOString().slice(0, 10)}</p>
          </div>
        </div>

        <div className="flex gap-4 py-5">
          <div className="grid flex-1 grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Billed To</p>
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

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Amount Due</p>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Description</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Due Date</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Already Paid</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Balance Due</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-2 text-navy-900">{line.label}</td>
              <td className="px-3 py-2 text-slate-500">{line.due_date}</td>
              <td className="px-3 py-2 text-right tabular-nums text-navy-900">
                {Number(line.amount).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-success-700">
                {Number(line.paid_amount).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-danger-600">
                {balance.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Unit Price</span>
              <span className="font-semibold text-navy-950">
                PKR {Number(booking.total_price).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Paid To-Date</span>
              <span className="font-semibold text-navy-950">PKR {totalPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-500">Overall Outstanding</span>
              <span className="font-semibold text-danger-600">PKR {outstanding.toLocaleString()}</span>
            </div>
          </div>

          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm">
            <p className="text-brand-600">This Invoice — Amount Payable</p>
            <p className="mt-2 text-2xl font-bold text-brand-800">PKR {balance.toLocaleString()}</p>
            <p className="mt-1 text-xs text-brand-500">Due on {line.due_date}</p>
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            {INVOICE_TERMS.map((term, i) => (
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
