import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type {
  CompanySettings,
  PartnerContribution,
  PartnerDrawing,
  PartnerExpense,
  PartnerSummary,
} from "../types";

const PARTNER_STATEMENT_TERMS = [
  "This statement reflects the partner's contributions, profit share and drawings as recorded in the company's official books as of the date shown.",
  "Profit share is calculated on each project's net profit per the partner's agreed share percentage; amounts shown as distributable remain subject to project cash flow.",
  "Any discrepancy must be reported in writing within 15 days of receipt, or this statement is deemed accepted and final.",
  "Withdrawals against the current account balance require a prior written request and management approval.",
  "This statement is confidential and issued solely for the named partner's record.",
];

type LedgerRow = {
  date: string;
  project: string;
  description: string;
  amount: number;
  sign: 1 | -1;
};

export default function PartnerStatementPrintPage() {
  const { id } = useParams();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["partner-summary", id],
    queryFn: async () => (await api.get<PartnerSummary>(`/partners/${id}/summary`)).data,
  });

  const { data: contributions } = useQuery({
    queryKey: ["partner-contributions", id],
    queryFn: async () =>
      (await api.get<PartnerContribution[]>("/partner-contributions/", { params: { partner_id: id } })).data,
  });

  const { data: partnerExpenses } = useQuery({
    queryKey: ["partner-expenses", id],
    queryFn: async () =>
      (await api.get<PartnerExpense[]>("/partner-expenses/", { params: { partner_id: id } })).data,
  });

  const { data: drawings } = useQuery({
    queryKey: ["partner-drawings", id],
    queryFn: async () =>
      (await api.get<PartnerDrawing[]>("/partner-drawings/", { params: { partner_id: id } })).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (isLoading || !summary) {
    return <div className="p-10 text-sm text-slate-400">Loading partner statement...</div>;
  }

  const projectName = (projectId: number) =>
    summary.projects.find((p) => p.project_id === projectId)?.project_name ?? `#${projectId}`;

  const ledger: LedgerRow[] = [
    ...(contributions ?? []).map((c) => ({
      date: c.contribution_date,
      project: projectName(c.project_id),
      description: `Contribution — ${c.purpose ?? "Investment"}`,
      amount: c.amount,
      sign: 1 as const,
    })),
    ...(partnerExpenses ?? []).map((e) => ({
      date: e.expense_date,
      project: projectName(e.project_id),
      description: `Paid on behalf — ${e.expense_account.name}`,
      amount: e.amount,
      sign: 1 as const,
    })),
    ...(drawings ?? []).map((d) => ({
      date: d.drawing_date,
      project: projectName(d.project_id),
      description: "Withdrawal",
      amount: d.amount,
      sign: -1 as const,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;

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
              Partner Statement
            </p>
            <p className="mt-1 font-mono text-sm text-slate-500">{summary.partner.partner_code}</p>
            <p className="text-xs text-slate-400">
              As of {new Date().toISOString().slice(0, 10)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">Partner</p>
            <p className="mt-0.5 font-medium text-navy-900">{summary.partner.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Contact</p>
            <p className="mt-0.5 font-medium text-navy-900">{summary.partner.contact_info || "—"}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Summary</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount (PKR)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-2 text-navy-900">Total Contributed</td>
              <td className="px-3 py-2 text-right tabular-nums">{summary.total_contributed.toLocaleString()}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-2 text-navy-900">Paid on Behalf of Company</td>
              <td className="px-3 py-2 text-right tabular-nums">{summary.total_partner_expense.toLocaleString()}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-2 text-navy-900">Profit Share Earned</td>
              <td className="px-3 py-2 text-right tabular-nums">{summary.total_share_amount.toLocaleString()}</td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-3 py-2 text-navy-900">Withdrawn</td>
              <td className="px-3 py-2 text-right tabular-nums text-danger-600">
                −{summary.total_drawn.toLocaleString()}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
              <td className="px-3 py-2">Current Account Balance</td>
              <td className="px-3 py-2 text-right tabular-nums">
                PKR {summary.total_current_account_balance.toLocaleString()}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 mb-2 text-sm font-semibold text-navy-950">Project-wise Share</p>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Project</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Share %</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Net Profit</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Their Share</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Distributable Now</th>
            </tr>
          </thead>
          <tbody>
            {summary.projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No project shares configured.
                </td>
              </tr>
            )}
            {summary.projects.map((row) => (
              <tr key={row.project_id} className="border-b border-slate-100">
                <td className="px-3 py-2 text-navy-900">{row.project_name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.share_percent}%</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.project_net_profit.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.partner_share_amount.toLocaleString()}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.partner_distributable_share.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-6 mb-2 text-sm font-semibold text-navy-950">Complete Ledger</p>
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Project</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Description</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  No ledger entries yet.
                </td>
              </tr>
            )}
            {ledger.map((row, i) => {
              running += row.sign * row.amount;
              return (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-500">{row.date}</td>
                  <td className="px-3 py-2 text-navy-900">{row.project}</td>
                  <td className="px-3 py-2 text-navy-900">{row.description}</td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${
                      row.sign > 0 ? "text-navy-900" : "text-danger-600"
                    }`}
                  >
                    {row.sign > 0 ? "" : "−"}
                    {row.amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-navy-900">
                    {running.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            {PARTNER_STATEMENT_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Partner Signature</div>
        </div>
      </div>
    </div>
  );
}
