import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Select } from "../components/ui/Input";
import type {
  Account,
  AgingReport,
  BalanceSheetReport,
  BrokerSummaryRow,
  CustomerWiseReport,
  EmployeeSummaryRow,
  GeneralLedgerReport,
  Material,
  MaterialSummaryRow,
  PartnerSummaryRow,
  ProfitLossReport,
  Project,
  SalesPurchaseReport,
  StockBalance,
  StockLedgerReport,
  TrialBalanceReport,
} from "../types";

type ReportTab =
  | "trial-balance"
  | "profit-loss"
  | "balance-sheet"
  | "general-ledger"
  | "aging"
  | "sales-purchase"
  | "stock"
  | "customer-wise"
  | "brokers-partners"
  | "material-employee";

const tabs: { key: ReportTab; label: string }[] = [
  { key: "trial-balance", label: "Trial Balance" },
  { key: "profit-loss", label: "Profit & Loss" },
  { key: "balance-sheet", label: "Balance Sheet" },
  { key: "general-ledger", label: "General Ledger" },
  { key: "aging", label: "Aging" },
  { key: "sales-purchase", label: "Sales / Purchase" },
  { key: "stock", label: "Stock" },
  { key: "customer-wise", label: "Customer-wise" },
  { key: "brokers-partners", label: "Broker / Partner" },
  { key: "material-employee", label: "Material / Employee" },
];

function BalanceBadge({ isBalanced }: { isBalanced: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isBalanced ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"
      }`}
    >
      {isBalanced ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {isBalanced ? "Balanced" : "Out of Balance"}
    </span>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = React.useState<ReportTab>("trial-balance");
  const [selectedAccountId, setSelectedAccountId] = React.useState("");
  const [selectedMaterialId, setSelectedMaterialId] = React.useState("");
  const [profitLossProjectId, setProfitLossProjectId] = React.useState("");

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });

  const { data: materials } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await api.get<Material[]>("/inventory/materials")).data,
  });

  const { data: trialBalance } = useQuery({
    queryKey: ["reports", "trial-balance"],
    queryFn: async () => (await api.get<TrialBalanceReport>("/reports/trial-balance")).data,
    enabled: tab === "trial-balance",
  });

  const { data: profitLoss } = useQuery({
    queryKey: ["reports", "profit-loss", profitLossProjectId],
    queryFn: async () =>
      (
        await api.get<ProfitLossReport>("/reports/profit-loss", {
          params: profitLossProjectId ? { project_id: Number(profitLossProjectId) } : undefined,
        })
      ).data,
    enabled: tab === "profit-loss",
  });

  const { data: balanceSheet } = useQuery({
    queryKey: ["reports", "balance-sheet"],
    queryFn: async () => (await api.get<BalanceSheetReport>("/reports/balance-sheet")).data,
    enabled: tab === "balance-sheet",
  });

  const { data: ledger } = useQuery({
    queryKey: ["reports", "general-ledger", selectedAccountId],
    queryFn: async () =>
      (await api.get<GeneralLedgerReport>(`/reports/general-ledger/${selectedAccountId}`)).data,
    enabled: tab === "general-ledger" && !!selectedAccountId,
  });

  const { data: aging } = useQuery({
    queryKey: ["reports", "aging"],
    queryFn: async () => (await api.get<AgingReport>("/reports/aging")).data,
    enabled: tab === "aging",
  });

  const { data: salesPurchase } = useQuery({
    queryKey: ["reports", "sales-purchase"],
    queryFn: async () => (await api.get<SalesPurchaseReport>("/reports/sales-purchase")).data,
    enabled: tab === "sales-purchase",
  });

  const { data: stock } = useQuery({
    queryKey: ["reports", "stock"],
    queryFn: async () => (await api.get<StockBalance[]>("/reports/stock")).data,
    enabled: tab === "stock",
  });

  const { data: stockLedger } = useQuery({
    queryKey: ["reports", "stock-ledger", selectedMaterialId],
    queryFn: async () =>
      (await api.get<StockLedgerReport>(`/reports/stock/ledger/${selectedMaterialId}`)).data,
    enabled: tab === "stock" && !!selectedMaterialId,
  });

  const { data: customerWise } = useQuery({
    queryKey: ["reports", "customer-wise"],
    queryFn: async () => (await api.get<CustomerWiseReport>("/reports/customer-wise")).data,
    enabled: tab === "customer-wise",
  });

  const { data: brokers } = useQuery({
    queryKey: ["reports", "brokers"],
    queryFn: async () => (await api.get<BrokerSummaryRow[]>("/reports/brokers")).data,
    enabled: tab === "brokers-partners",
  });

  const { data: partnersReport } = useQuery({
    queryKey: ["reports", "partners"],
    queryFn: async () => (await api.get<PartnerSummaryRow[]>("/reports/partners")).data,
    enabled: tab === "brokers-partners",
  });

  const { data: materialsReport } = useQuery({
    queryKey: ["reports", "materials"],
    queryFn: async () => (await api.get<MaterialSummaryRow[]>("/reports/materials")).data,
    enabled: tab === "material-employee",
  });

  const { data: employeesReport } = useQuery({
    queryKey: ["reports", "employees"],
    queryFn: async () => (await api.get<EmployeeSummaryRow[]>("/reports/employees")).data,
    enabled: tab === "material-employee",
  });

  const postableAccounts = accounts?.filter((a) => !a.is_control) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Financial Reports</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          General Ledger, Trial Balance, Profit &amp; Loss, and Balance Sheet.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-navy-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "trial-balance" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Trial Balance</h3>
              {trialBalance && <BalanceBadge isBalanced={trialBalance.is_balanced} />}
            </div>
            <Button size="sm" onClick={() => window.open("/reports/print/trial-balance", "_blank")}>
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Account</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 text-right font-medium">Debit</th>
                  <th className="px-5 py-3 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {trialBalance?.rows.map((r) => (
                  <tr key={r.account_id}>
                    <td className="px-5 py-2.5 text-navy-900 dark:text-slate-100">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{r.code}</span> {r.name}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{r.nature}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {r.debit ? r.debit.toLocaleString() : ""}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {r.credit ? r.credit.toLocaleString() : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              {trialBalance && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-semibold text-navy-950 dark:text-white">
                    <td colSpan={2} className="px-5 py-3 text-right">
                      Total
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {trialBalance.total_debit.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {trialBalance.total_credit.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "profit-loss" && (
        <div className="flex justify-end">
          <Select
            value={profitLossProjectId}
            onChange={(e) => setProfitLossProjectId(e.target.value)}
            className="w-56"
          >
            <option value="">All Projects (Company-wide)</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {tab === "profit-loss" && profitLoss && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Profit &amp; Loss {profitLoss.project_name ? `— ${profitLoss.project_name}` : "(Company-wide)"}
            </h3>
            <Button
              size="sm"
              onClick={() =>
                window.open(
                  `/reports/print/profit-loss${profitLossProjectId ? `?project_id=${profitLossProjectId}` : ""}`,
                  "_blank",
                )
              }
            >
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </div>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Revenue</p>
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {profitLoss.revenue_lines.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-2 text-navy-800 dark:text-slate-200">{l.name}</td>
                      <td className="py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {l.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 dark:border-navy-700 font-semibold text-navy-950 dark:text-white">
                    <td className="py-2">Total Revenue</td>
                    <td className="py-2 text-right tabular-nums">
                      {profitLoss.total_revenue.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Expenses</p>
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {profitLoss.expense_lines.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-2 text-navy-800 dark:text-slate-200">{l.name}</td>
                      <td className="py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {l.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 dark:border-navy-700 font-semibold text-navy-950 dark:text-white">
                    <td className="py-2">Total Expenses</td>
                    <td className="py-2 text-right tabular-nums">
                      {profitLoss.total_expense.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-lg bg-brand-50 px-4 py-3 text-right">
              <span className="text-sm text-brand-700">Net Profit: </span>
              <span className="text-lg font-bold text-brand-900">
                PKR {profitLoss.net_profit.toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "balance-sheet" && balanceSheet && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Balance Sheet</h3>
              <BalanceBadge isBalanced={balanceSheet.is_balanced} />
            </div>
            <Button size="sm" onClick={() => window.open("/reports/print/balance-sheet", "_blank")}>
              <Printer className="h-4 w-4" />
              Print / PDF
            </Button>
          </div>
          <CardContent className="grid grid-cols-2 gap-8">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Assets</p>
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {balanceSheet.assets.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-2 text-navy-800 dark:text-slate-200">{l.name}</td>
                      <td className="py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {l.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 dark:border-navy-700 font-semibold text-navy-950 dark:text-white">
                    <td className="py-2">Total Assets</td>
                    <td className="py-2 text-right tabular-nums">
                      {balanceSheet.total_assets.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Liabilities &amp; Capital
              </p>
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {balanceSheet.liabilities.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-2 text-navy-800 dark:text-slate-200">{l.name}</td>
                      <td className="py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {l.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {balanceSheet.capital.map((l) => (
                    <tr key={l.account_id}>
                      <td className="py-2 text-navy-800 dark:text-slate-200">{l.name}</td>
                      <td className="py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {l.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 text-navy-800 dark:text-slate-200">Retained Earnings (Net Profit)</td>
                    <td className="py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {balanceSheet.retained_earnings.toLocaleString()}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-navy-700 font-semibold text-navy-950 dark:text-white">
                    <td className="py-2">Total Liabilities &amp; Capital</td>
                    <td className="py-2 text-right tabular-nums">
                      {(balanceSheet.total_liabilities + balanceSheet.total_capital).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "general-ledger" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">General Ledger</h3>
              <Select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-56"
              >
                <option value="">Select account</option>
                {postableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            {selectedAccountId && (
              <Button
                size="sm"
                onClick={() => window.open(`/reports/print/general-ledger/${selectedAccountId}`, "_blank")}
              >
                <Printer className="h-4 w-4" />
                Print / PDF
              </Button>
            )}
          </div>
          <CardContent className="p-0">
            {!selectedAccountId ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                Select an account to view its ledger.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Voucher</th>
                    <th className="px-5 py-3 font-medium">Narration</th>
                    <th className="px-5 py-3 text-right font-medium">Debit</th>
                    <th className="px-5 py-3 text-right font-medium">Credit</th>
                    <th className="px-5 py-3 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  <tr className="bg-slate-50/50">
                    <td colSpan={5} className="px-5 py-2 text-slate-500 dark:text-slate-400">
                      Opening Balance
                    </td>
                    <td className="px-5 py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {ledger?.opening_balance.toLocaleString()}
                    </td>
                  </tr>
                  {ledger?.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{l.voucher_date}</td>
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">{l.voucher_no}</td>
                      <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{l.narration || "—"}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {l.debit ? l.debit.toLocaleString() : ""}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {l.credit ? l.credit.toLocaleString() : ""}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                        {l.running_balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {ledger && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 font-semibold text-navy-950 dark:text-white">
                      <td colSpan={5} className="px-5 py-3 text-right">
                        Closing Balance
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {ledger.closing_balance.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "aging" && aging && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Installment Aging (as of {aging.as_of_date})
            </h3>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Booking</th>
                  <th className="px-5 py-3 font-medium">Allottee</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 text-right font-medium">0-30 Days</th>
                  <th className="px-5 py-3 text-right font-medium">31-60 Days</th>
                  <th className="px-5 py-3 text-right font-medium">61-90 Days</th>
                  <th className="px-5 py-3 text-right font-medium">90+ Days</th>
                  <th className="px-5 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {aging.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No overdue installments.
                    </td>
                  </tr>
                )}
                {aging.rows.map((r) => (
                  <tr key={r.booking_id}>
                    <td className="px-5 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {r.booking_ref_no}
                    </td>
                    <td className="px-5 py-2.5 text-navy-900 dark:text-slate-100">{r.allottee_name}</td>
                    <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{r.project_name}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {r.bucket_0_30 ? r.bucket_0_30.toLocaleString() : ""}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {r.bucket_31_60 ? r.bucket_31_60.toLocaleString() : ""}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {r.bucket_61_90 ? r.bucket_61_90.toLocaleString() : ""}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-danger-600">
                      {r.bucket_90_plus ? r.bucket_90_plus.toLocaleString() : ""}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                      {r.total_outstanding.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              {aging.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-semibold text-navy-950 dark:text-white">
                    <td colSpan={3} className="px-5 py-3 text-right">
                      Total
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{aging.total_0_30.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{aging.total_31_60.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{aging.total_61_90.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{aging.total_90_plus.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{aging.grand_total.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "sales-purchase" && salesPurchase && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Sales (Bookings)
              </p>
              <p className="text-2xl font-semibold text-navy-950 dark:text-white">
                PKR {salesPurchase.sales_total.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {salesPurchase.sales_count} booking{salesPurchase.sales_count === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Purchases (GRN)
              </p>
              <p className="text-2xl font-semibold text-navy-950 dark:text-white">
                PKR {salesPurchase.purchase_total.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {salesPurchase.purchase_count} GRN{salesPurchase.purchase_count === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "stock" && (
        <div className="space-y-4">
          <Card>
            <div className="border-b border-slate-100 dark:border-navy-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Stock Balance</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Material</th>
                  <th className="px-5 py-3 font-medium">Warehouse</th>
                  <th className="px-5 py-3 text-right font-medium">Quantity</th>
                  <th className="px-5 py-3 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {stock?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                )}
                {stock?.map((s) => (
                  <tr key={`${s.material_id}-${s.warehouse_id}`}>
                    <td className="px-5 py-2.5 text-navy-900 dark:text-slate-100">{s.material_name}</td>
                    <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{s.warehouse_name ?? "—"}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {s.balance_qty.toLocaleString()} {s.unit_of_measure}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      PKR {s.balance_value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-navy-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Material Ledger</h3>
              <Select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-56"
              >
                <option value="">Select material</option>
                {materials?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <CardContent className="p-0">
              {!selectedMaterialId ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                  Select a material to view its movement history.
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Ref</th>
                      <th className="px-5 py-3 text-right font-medium">Qty</th>
                      <th className="px-5 py-3 text-right font-medium">Rate</th>
                      <th className="px-5 py-3 text-right font-medium">Balance Qty</th>
                      <th className="px-5 py-3 text-right font-medium">Balance Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    <tr className="bg-slate-50/50">
                      <td colSpan={5} className="px-5 py-2 text-slate-500 dark:text-slate-400">
                        Opening Balance
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {stockLedger?.opening_qty.toLocaleString()}
                      </td>
                      <td className="px-5 py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                        {stockLedger?.opening_value.toLocaleString()}
                      </td>
                    </tr>
                    {stockLedger?.lines.map((l, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{l.movement_date}</td>
                        <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">
                          {l.movement_type} — {l.ref_type}
                        </td>
                        <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">#{l.ref_id}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                          {l.movement_type === "IN" ? "+" : "-"}
                          {l.quantity.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                          {l.rate.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                          {l.balance_qty.toLocaleString()}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                          {l.balance_value.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {stockLedger && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 font-semibold text-navy-950 dark:text-white">
                        <td colSpan={5} className="px-5 py-3 text-right">
                          Closing Balance
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {stockLedger.closing_qty.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {stockLedger.closing_value.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "customer-wise" && customerWise && (
        <Card>
          <div className="border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Customer-wise Summary</h3>
          </div>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Allottee</th>
                  <th className="px-5 py-3 text-right font-medium">Bookings</th>
                  <th className="px-5 py-3 text-right font-medium">Total Booked</th>
                  <th className="px-5 py-3 text-right font-medium">Total Received</th>
                  <th className="px-5 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {customerWise.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No bookings yet.
                    </td>
                  </tr>
                )}
                {customerWise.rows.map((r) => (
                  <tr key={r.allottee_id}>
                    <td className="px-5 py-2.5 text-navy-900 dark:text-slate-100">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{r.allottee_code}</span>{" "}
                      {r.name}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {r.bookings_count}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {r.total_booked.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {r.total_received.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                      {r.balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              {customerWise.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 font-semibold text-navy-950 dark:text-white">
                    <td colSpan={2} className="px-5 py-3 text-right">
                      Total
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {customerWise.grand_total_booked.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {customerWise.grand_total_received.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {customerWise.grand_total_balance.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "brokers-partners" && (
        <div className="space-y-4">
          <Card>
            <div className="border-b border-slate-100 dark:border-navy-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Brokers</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Broker</th>
                  <th className="px-5 py-3 text-right font-medium">Eligible</th>
                  <th className="px-5 py-3 text-right font-medium">Paid</th>
                  <th className="px-5 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {brokers?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No brokers yet.
                    </td>
                  </tr>
                )}
                {brokers?.map((b) => (
                  <tr key={b.agent_id}>
                    <td className="px-5 py-2.5 text-navy-900 dark:text-slate-100">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{b.agent_code}</span>{" "}
                      {b.name}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {b.total_eligible.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {b.total_paid.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                      {b.total_balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <div className="border-b border-slate-100 dark:border-navy-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Investor / Partners</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Partner</th>
                  <th className="px-5 py-3 text-right font-medium">Share Amount</th>
                  <th className="px-5 py-3 text-right font-medium">Drawn</th>
                  <th className="px-5 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {partnersReport?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No partners yet.
                    </td>
                  </tr>
                )}
                {partnersReport?.map((p) => (
                  <tr key={p.partner_id}>
                    <td className="px-5 py-2.5 text-navy-900 dark:text-slate-100">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{p.partner_code}</span>{" "}
                      {p.name}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {p.total_share_amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {p.total_drawn.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                      {p.total_balance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === "material-employee" && (
        <div className="space-y-4">
          <Card>
            <div className="border-b border-slate-100 dark:border-navy-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Material Summary</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Material</th>
                  <th className="px-5 py-3 text-right font-medium">Purchased</th>
                  <th className="px-5 py-3 text-right font-medium">Issued</th>
                  <th className="px-5 py-3 text-right font-medium">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {materialsReport?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No materials yet.
                    </td>
                  </tr>
                )}
                {materialsReport?.map((m) => (
                  <tr key={m.material_id}>
                    <td className="px-5 py-2.5 text-navy-900 dark:text-slate-100">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{m.material_code}</span>{" "}
                      {m.name}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {m.total_purchased_qty.toLocaleString()} {m.unit_of_measure}
                      <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                        (PKR {m.total_purchased_value.toLocaleString()})
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {m.total_issued_qty.toLocaleString()} {m.unit_of_measure}
                      <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                        (PKR {m.total_issued_value.toLocaleString()})
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                      {m.current_balance_qty.toLocaleString()} {m.unit_of_measure}
                      <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">
                        (PKR {m.current_balance_value.toLocaleString()})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <div className="border-b border-slate-100 dark:border-navy-800 px-5 py-4">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Employee Summary</h3>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Employee</th>
                  <th className="px-5 py-3 font-medium">Wage Type</th>
                  <th className="px-5 py-3 text-right font-medium">Payments</th>
                  <th className="px-5 py-3 text-right font-medium">Total Paid</th>
                  <th className="px-5 py-3 font-medium">Last Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {employeesReport?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No employees yet.
                    </td>
                  </tr>
                )}
                {employeesReport?.map((e) => (
                  <tr key={e.employee_id}>
                    <td className="px-5 py-2.5 text-navy-900 dark:text-slate-100">
                      <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{e.employee_code}</span>{" "}
                      {e.name}
                      {e.designation && (
                        <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">({e.designation})</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{e.wage_type}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-navy-900 dark:text-slate-100">
                      {e.payment_count}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                      {e.total_paid.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500 dark:text-slate-400">{e.last_payment_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
