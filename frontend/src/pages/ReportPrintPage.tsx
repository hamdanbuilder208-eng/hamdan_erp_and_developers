import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { BalanceSheetReport, CompanySettings, ProfitLossReport, TrialBalanceReport } from "../types";

const todayIso = () => new Date().toISOString().slice(0, 10);

function PrintShell({
  title,
  children,
}: {
  title: string;
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
            <p className="text-xs text-slate-400">As of {todayIso()}</p>
          </div>
        </div>
        <div className="py-5">{children}</div>
        <div className="mt-16 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Approved By</div>
        </div>
      </div>
    </div>
  );
}

function TrialBalancePrint() {
  const { data } = useQuery({
    queryKey: ["reports", "trial-balance"],
    queryFn: async () => (await api.get<TrialBalanceReport>("/reports/trial-balance")).data,
  });
  if (!data) return <p className="text-sm text-slate-400">Loading...</p>;

  return (
    <PrintShell title="Trial Balance">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-y border-slate-300 bg-slate-50">
            <th className="px-3 py-2 font-semibold text-slate-600">Code</th>
            <th className="px-3 py-2 font-semibold text-slate-600">Account</th>
            <th className="px-3 py-2 text-right font-semibold text-slate-600">Debit</th>
            <th className="px-3 py-2 text-right font-semibold text-slate-600">Credit</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.account_id} className="border-b border-slate-100">
              <td className="px-3 py-2 font-mono text-xs text-slate-500">{r.code}</td>
              <td className="px-3 py-2 text-navy-900">{r.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.debit ? r.debit.toLocaleString() : ""}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.credit ? r.credit.toLocaleString() : ""}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
            <td colSpan={2} className="px-3 py-2 text-right">
              Total
            </td>
            <td className="px-3 py-2 text-right tabular-nums">{data.total_debit.toLocaleString()}</td>
            <td className="px-3 py-2 text-right tabular-nums">{data.total_credit.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      <p className={`mt-3 text-xs font-medium ${data.is_balanced ? "text-success-700" : "text-danger-600"}`}>
        {data.is_balanced ? "Books are balanced." : "Warning: books are out of balance."}
      </p>
    </PrintShell>
  );
}

function ProfitLossPrint() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project_id");

  const { data } = useQuery({
    queryKey: ["reports", "profit-loss", projectId],
    queryFn: async () =>
      (
        await api.get<ProfitLossReport>("/reports/profit-loss", {
          params: projectId ? { project_id: Number(projectId) } : undefined,
        })
      ).data,
  });
  if (!data) return <p className="text-sm text-slate-400">Loading...</p>;

  return (
    <PrintShell title={`Profit & Loss Statement${data.project_name ? ` — ${data.project_name}` : ""}`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue</p>
      <table className="mb-6 w-full border-collapse text-left text-sm">
        <tbody>
          {data.revenue_lines.map((l) => (
            <tr key={l.account_id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-navy-800">{l.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.amount.toLocaleString()}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
            <td className="px-3 py-2">Total Revenue</td>
            <td className="px-3 py-2 text-right tabular-nums">{data.total_revenue.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Expenses</p>
      <table className="mb-6 w-full border-collapse text-left text-sm">
        <tbody>
          {data.expense_lines.map((l) => (
            <tr key={l.account_id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-navy-800">{l.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.amount.toLocaleString()}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
            <td className="px-3 py-2">Total Expenses</td>
            <td className="px-3 py-2 text-right tabular-nums">{data.total_expense.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <div className="rounded-lg bg-brand-50 px-4 py-3 text-right">
        <span className="text-sm text-brand-700">Net Profit: </span>
        <span className="text-lg font-bold text-brand-900">PKR {data.net_profit.toLocaleString()}</span>
      </div>
    </PrintShell>
  );
}

function BalanceSheetPrint() {
  const { data } = useQuery({
    queryKey: ["reports", "balance-sheet"],
    queryFn: async () => (await api.get<BalanceSheetReport>("/reports/balance-sheet")).data,
  });
  if (!data) return <p className="text-sm text-slate-400">Loading...</p>;

  return (
    <PrintShell title="Balance Sheet">
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Assets</p>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {data.assets.map((l) => (
                <tr key={l.account_id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-navy-800">{l.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.amount.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
                <td className="px-3 py-2">Total Assets</td>
                <td className="px-3 py-2 text-right tabular-nums">{data.total_assets.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Liabilities &amp; Capital
          </p>
          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              {data.liabilities.map((l) => (
                <tr key={l.account_id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-navy-800">{l.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.amount.toLocaleString()}</td>
                </tr>
              ))}
              {data.capital.map((l) => (
                <tr key={l.account_id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-navy-800">{l.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{l.amount.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 text-navy-800">Retained Earnings</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {data.retained_earnings.toLocaleString()}
                </td>
              </tr>
              <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
                <td className="px-3 py-2">Total Liabilities &amp; Capital</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {(data.total_liabilities + data.total_capital).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <p className={`mt-4 text-xs font-medium ${data.is_balanced ? "text-success-700" : "text-danger-600"}`}>
        {data.is_balanced ? "Balance sheet is balanced." : "Warning: balance sheet is out of balance."}
      </p>
    </PrintShell>
  );
}

export default function ReportPrintPage() {
  const { type } = useParams();

  if (type === "trial-balance") return <TrialBalancePrint />;
  if (type === "profit-loss") return <ProfitLossPrint />;
  if (type === "balance-sheet") return <BalanceSheetPrint />;
  return <p className="p-10 text-sm text-slate-400">Unknown report type.</p>;
}
