import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, OfficeExpense, OwnerPersonalExpense, WagePayment } from "../types";

const EXPENSE_TERMS = [
  "This voucher is valid only when signed by the preparer and approved by an authorized signatory.",
  "The amount stated has been paid/disbursed from the account noted above and recorded in the company's official books.",
  "This voucher must not be processed or claimed more than once.",
  "Any correction or cancellation must be authorized in writing by management.",
  "Supporting documents/receipts, where applicable, are attached and retained with this voucher.",
];

function PrintShell({ title, refNo, date, children }: { title: string; refNo: string; date: string; children: React.ReactNode }) {
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
            <p className="text-lg font-bold text-navy-950">
              {companySettings?.company_name ?? "Hamdan Builders and Developers"}
            </p>
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
            {EXPENSE_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Approved By</div>
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

function OfficeExpensePrint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["office-expense", id],
    queryFn: async () => (await api.get<OfficeExpense>(`/expenses/office/${id}`)).data,
  });
  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  return (
    <PrintShell title="Office Expense Voucher" refNo={data.expense_no} date={data.expense_date}>
      <Row label="Expense Head" value={data.expense_head.name} />
      <Row label="Project" value={data.project?.project_name ?? "General (Company-wide)"} />
      <Row label="Paid From" value={data.paid_from.name} />
      <Row label="Narration" value={data.narration || "—"} />
      <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-right">
        <span className="text-sm text-brand-700">Amount: </span>
        <span className="text-lg font-bold text-brand-900">PKR {Number(data.amount).toLocaleString()}</span>
      </div>
    </PrintShell>
  );
}

function WagePaymentPrint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["wage-payment", id],
    queryFn: async () => (await api.get<WagePayment>(`/expenses/wages/${id}`)).data,
  });
  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  return (
    <PrintShell title="Wage / Salary Payment Slip" refNo={data.payment_no} date={data.payment_date}>
      <Row label="Employee" value={`${data.employee.name} (${data.employee.employee_code})`} />
      <Row label="Designation" value={data.employee.designation ?? "—"} />
      <Row label="Period" value={`${data.period_from} to ${data.period_to}`} />
      <Row label="Paid From" value={data.paid_from.name} />
      <Row label="Gross Amount" value={Number(data.gross_amount).toLocaleString()} />
      <Row label="Advances / Deductions" value={`-${Number(data.advances_deductions).toLocaleString()}`} />
      <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-right">
        <span className="text-sm text-brand-700">Net Paid: </span>
        <span className="text-lg font-bold text-brand-900">PKR {Number(data.net_paid).toLocaleString()}</span>
      </div>
    </PrintShell>
  );
}

function OwnerExpensePrint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["owner-expense", id],
    queryFn: async () => (await api.get<OwnerPersonalExpense>(`/expenses/owner-personal/${id}`)).data,
  });
  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  return (
    <PrintShell title="Owner Personal Expense Voucher" refNo={data.expense_no} date={data.expense_date}>
      <Row label="Category" value={data.category} />
      <Row label="Source Account" value={data.source_account.name} />
      <Row label="Remarks" value={data.remarks || "—"} />
      <div className="mt-4 rounded-lg bg-brand-50 px-4 py-3 text-right">
        <span className="text-sm text-brand-700">Amount: </span>
        <span className="text-lg font-bold text-brand-900">PKR {Number(data.amount).toLocaleString()}</span>
      </div>
    </PrintShell>
  );
}

export default function ExpensePrintPage() {
  const { type, id } = useParams();
  if (!id) return <p className="p-10 text-sm text-slate-400">Missing reference.</p>;
  if (type === "office") return <OfficeExpensePrint id={id} />;
  if (type === "wages") return <WagePaymentPrint id={id} />;
  if (type === "owner-personal") return <OwnerExpensePrint id={id} />;
  return <p className="p-10 text-sm text-slate-400">Unknown expense type.</p>;
}
