import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, PettyCashExpense, PettyCashTopup } from "../types";

const VOUCHER_TERMS = [
  "This voucher is valid only when signed by the preparer and approved by an authorized signatory.",
  "The amount stated has been paid/disbursed and recorded in the company's official books.",
  "This voucher must not be processed or claimed more than once.",
  "Any correction or cancellation must be authorized in writing by management.",
];

function PrintShell({
  title,
  refNo,
  date,
  children,
}: {
  title: string;
  refNo: string;
  date: string;
  children: React.ReactNode;
}) {
  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

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
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">{title}</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{refNo}</p>
            <p className="text-xs text-slate-400">{date}</p>
          </div>
        </div>
        <div className="py-5">{children}</div>

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            {VOUCHER_TERMS.map((term, i) => (
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  );
}

function TopupPrint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["petty-cash-topup", id],
    queryFn: async () => (await api.get<PettyCashTopup>(`/petty-cash/topups/${id}`)).data,
  });
  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  return (
    <PrintShell title="Petty Cash Top-up" refNo={data.topup_no} date={data.topup_date}>
      <Row label="Float / Holder" value={data.float.holder_name} />
      <Row label="Paid From" value={data.paid_from.name} />
      <Row label="Narration" value={data.narration || "—"} />
      <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-right">
        <span className="text-sm text-brand-700">Amount: </span>
        <span className="text-lg font-bold text-brand-900">PKR {Number(data.amount).toLocaleString()}</span>
      </div>
    </PrintShell>
  );
}

function ExpensePrint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["petty-cash-expense", id],
    queryFn: async () => (await api.get<PettyCashExpense>(`/petty-cash/expenses/${id}`)).data,
  });
  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  return (
    <PrintShell title="Petty Cash Expense Voucher" refNo={data.expense_no} date={data.expense_date}>
      <Row label="Float / Holder" value={data.float.holder_name} />
      <Row label="Description" value={data.description} />
      <Row label="Project" value={data.project?.project_name ?? "General"} />
      {data.material && (
        <Row
          label="Material"
          value={`${data.quantity} ${data.material.unit_of_measure} ${data.material.name}${
            data.warehouse ? ` — ${data.warehouse.name}` : " — direct to project site"
          }`}
        />
      )}
      <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-right">
        <span className="text-sm text-brand-700">Amount: </span>
        <span className="text-lg font-bold text-brand-900">PKR {Number(data.amount).toLocaleString()}</span>
      </div>
    </PrintShell>
  );
}

export default function PettyCashPrintPage() {
  const { type, id } = useParams();
  if (!id) return <p className="p-10 text-sm text-slate-400">Missing reference.</p>;
  if (type === "topup") return <TopupPrint id={id} />;
  if (type === "expense") return <ExpensePrint id={id} />;
  return <p className="p-10 text-sm text-slate-400">Unknown document type.</p>;
}
