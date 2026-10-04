import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { paymentModeLabel } from "../components/payments/PaymentDetailsFields";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import hamdanIcon from "../assets/hamdan-icon-transparent.png";
import type { CompanySettings, ContractAgreementDetail, ContractorPaymentDetail } from "../types";

const CONTRACTOR_TERMS = [
  "This payment is made against the contract agreement referenced above, as per its agreed rates and terms.",
  "Retention and withholding tax are deducted from each bill as per the agreement; retention is released separately.",
  "This voucher is valid only when signed by the preparer and an authorized signatory.",
  "This payment must not be claimed or processed more than once.",
  "In case of any discrepancy, the company's official accounts and records shall prevail.",
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-navy-900">{value}</span>
    </div>
  );
}

const pkr = (n: number) => `PKR ${Number(n).toLocaleString()}`;

export default function ContractorPaymentPrintPage() {
  const { id } = useParams();

  const { data } = useQuery({
    queryKey: ["contractor-payment", id],
    queryFn: async () => (await api.get<ContractorPaymentDetail>(`/contractors/payments/${id}`)).data,
  });

  // The agreement's account as it stands now, for the summary box.
  const { data: agreement } = useQuery({
    queryKey: ["contract-agreement", data?.agreement_id],
    queryFn: async () =>
      (await api.get<ContractAgreementDetail>(`/contractors/agreements/${data!.agreement_id}`)).data,
    enabled: !!data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  const contractor = data.agreement.contractor;

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
          <div className="flex items-center gap-3">
            <img src={hamdanIcon} alt="Hamdan" className="h-14 w-auto shrink-0" />
            <p className="text-lg font-bold text-navy-950">
              {companySettings?.company_name ?? "Hamdan Builders and Developers"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">Contractor Payment</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{data.payment_no}</p>
            <p className="text-xs text-slate-400">{data.payment_date}</p>
          </div>
        </div>

        <div className="py-5">
          <Row label="Contractor" value={`${contractor.name} (${contractor.contractor_code})`} />
          <Row label="CNIC" value={contractor.cnic} />
          <Row label="Agreement" value={data.agreement.agreement_no} />
          <Row label="Project" value={data.agreement.project_name} />
          <Row
            label="Work"
            value={`${data.agreement.scope_title} · ${data.agreement.work_type}${
              data.agreement.floors_scope ? ` · ${data.agreement.floors_scope}` : ""
            }`}
          />
          <Row label="Payment For" value={data.purpose} />
          <Row label="Paid From" value={data.credit_account.name} />
          <Row label="Mode of Payment" value={paymentModeLabel(data) || "Cash"} />
          <Row label="Narration" value={data.narration || "—"} />
          <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-right">
            <span className="text-sm text-brand-700">Amount Paid: </span>
            <span className="text-lg font-bold text-brand-900">{pkr(data.amount)}</span>
          </div>
        </div>

        {agreement && (
          <div className="grid grid-cols-2 gap-x-6 rounded-lg border border-slate-200 p-4 text-sm">
            <Row label="Contract Amount" value={pkr(agreement.contract_amount)} />
            <Row label="Work Billed" value={pkr(agreement.billed_gross)} />
            <Row label="Total Paid" value={pkr(agreement.paid_total)} />
            <Row label="Retention Held" value={pkr(agreement.retention_held)} />
            <Row label="WHT Deducted" value={pkr(agreement.wht_total)} />
            <Row
              label={agreement.due_now < 0 ? "Advance Not Yet Billed" : "Balance Due"}
              value={pkr(Math.abs(agreement.due_now))}
            />
          </div>
        )}

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            {CONTRACTOR_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Received By (Contractor)</div>
        </div>
      </div>
    </div>
  );
}
