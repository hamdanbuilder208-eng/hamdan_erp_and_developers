import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CommissionPayout, CompanySettings } from "../types";

const COMMISSION_TERMS = [
  "This payment is made against the commission earned on the booking referenced above, as per the agreed commission structure.",
  "This voucher is valid only when signed by the preparer and an authorized signatory.",
  "The amount stated has been paid from the account noted above and recorded in the company's official books.",
  "This payment must not be claimed or processed more than once.",
  "In case of any discrepancy, the company's official accounts and records shall prevail.",
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  );
}

export default function CommissionPayoutPrintPage() {
  const { id } = useParams();

  const { data } = useQuery({
    queryKey: ["commission-payout", id],
    queryFn: async () => (await api.get<CommissionPayout>(`/commission-payouts/${id}`)).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;

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
              Broker Commission Payment
            </p>
            <p className="mt-1 font-mono text-sm text-slate-500">{data.payout_no}</p>
            <p className="text-xs text-slate-400">{data.payout_date}</p>
          </div>
        </div>

        <div className="py-5">
          <Row label="Agent" value={`${data.agent.name} (${data.agent.agent_code})`} />
          <Row label="Booking" value={data.booking.booking_ref_no} />
          <Row
            label="Project / Unit"
            value={`${data.booking.project.project_name} · ${data.booking.unit.unit_number}`}
          />
          <Row label="Allottee" value={data.booking.allottee.name} />
          <Row label="Paid From" value={data.credit_account.name} />
          <Row label="Narration" value={data.narration || "—"} />
          <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-right">
            <span className="text-sm text-brand-700">Amount Paid: </span>
            <span className="text-lg font-bold text-brand-900">PKR {Number(data.amount).toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            {COMMISSION_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Received By (Agent)</div>
        </div>
      </div>
    </div>
  );
}
