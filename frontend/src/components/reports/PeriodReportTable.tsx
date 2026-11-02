import * as React from "react";
import type {
  PeriodReport,
  PeriodReportCategory,
  PeriodReportGroupBy,
  PeriodReportPeriod,
} from "../../types";

export const PERIOD_CATEGORIES: { key: PeriodReportCategory; label: string; itemLabel: string; partyLabel: string }[] = [
  { key: "material_purchases", label: "Material Purchases", itemLabel: "Material", partyLabel: "Vendor" },
  { key: "material_issues", label: "Material Issued to Projects", itemLabel: "Material", partyLabel: "Issued To" },
  { key: "customer_receipts", label: "Customer Receipts", itemLabel: "Payment Type", partyLabel: "Customer" },
  { key: "expenses", label: "Office / Project Expenses", itemLabel: "Expense Head", partyLabel: "Party" },
  { key: "contractor_payments", label: "Contractor Payments", itemLabel: "Work Type", partyLabel: "Contractor" },
  { key: "wages", label: "Wages / Salaries", itemLabel: "Designation", partyLabel: "Employee" },
  { key: "rent_received", label: "Rent Received", itemLabel: "Unit / Property", partyLabel: "Tenant" },
  { key: "commission_paid", label: "Broker Commission Paid", itemLabel: "Booking", partyLabel: "Broker" },
];

export const PERIODS: { key: PeriodReportPeriod; label: string }[] = [
  { key: "day", label: "Day-wise" },
  { key: "week", label: "Week-wise" },
  { key: "month", label: "Month-wise" },
  { key: "year", label: "Year-wise" },
];

export const categoryInfo = (key: PeriodReportCategory) =>
  PERIOD_CATEGORIES.find((c) => c.key === key) ?? PERIOD_CATEGORIES[0];

export const groupByLabel = (category: PeriodReportCategory, g: PeriodReportGroupBy) =>
  g === "project"
    ? "Project"
    : g === "payment_mode"
      ? "Payment Mode"
      : g === "item"
        ? categoryInfo(category).itemLabel
        : categoryInfo(category).partyLabel;

/** Everything the report request needs; also round-tripped through the print page URL. */
export type PeriodReportFilters = {
  category: PeriodReportCategory;
  period: PeriodReportPeriod;
  date_from: string;
  date_to: string;
  project_id: string;
  item: string;
  payment_mode: string;
  party: string;
  group_by: "" | PeriodReportGroupBy;
};

export const periodReportParams = (f: PeriodReportFilters) =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== "")) as Record<string, string>;

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/** Periods down the side; when split by something, one row per group inside each period plus a subtotal. */
export function PeriodReportTable({ report, compact = false }: { report: PeriodReport; compact?: boolean }) {
  const grouped = !!report.group_by;
  const showQty = report.rows.some((r) => r.quantity !== null) || report.total_quantity !== null;
  const cell = compact ? "px-3 py-1.5" : "px-5 py-2.5";

  const periods: { label: string; rows: PeriodReport["rows"] }[] = [];
  for (const r of report.rows) {
    const last = periods[periods.length - 1];
    if (last && last.label === r.period_label) last.rows.push(r);
    else periods.push({ label: r.period_label, rows: [r] });
  }

  const qty = (q: number | null, unit: string | null) => (q === null ? "—" : `${fmt(q)}${unit ? ` ${unit}` : ""}`);

  return (
    <table className="w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-navy-800/60 dark:text-slate-400">
        <tr>
          <th className={`${cell} font-medium`}>Period</th>
          {grouped && <th className={`${cell} font-medium`}>{groupByLabel(report.category, report.group_by!)}</th>}
          <th className={`${cell} text-right font-medium`}>Entries</th>
          {showQty && <th className={`${cell} text-right font-medium`}>Quantity</th>}
          <th className={`${cell} text-right font-medium`}>Amount (PKR)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
        {report.rows.length === 0 && (
          <tr>
            <td colSpan={5} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
              Nothing found for these filters.
            </td>
          </tr>
        )}
        {periods.map((p) => (
          <React.Fragment key={p.label}>
            {p.rows.map((r, i) => (
              <tr key={`${p.label}-${r.group ?? ""}`}>
                <td className={`${cell} font-medium text-navy-900 dark:text-slate-100`}>{i === 0 ? p.label : ""}</td>
                {grouped && <td className={`${cell} text-slate-600 dark:text-slate-300`}>{r.group}</td>}
                <td className={`${cell} text-right tabular-nums text-slate-500 dark:text-slate-400`}>{r.count}</td>
                {showQty && (
                  <td className={`${cell} text-right tabular-nums text-slate-600 dark:text-slate-300`}>
                    {qty(r.quantity, r.unit)}
                  </td>
                )}
                <td className={`${cell} text-right tabular-nums text-navy-900 dark:text-slate-100`}>{fmt(r.amount)}</td>
              </tr>
            ))}
            {grouped && p.rows.length > 1 && (
              <tr className="bg-slate-50/60 dark:bg-navy-800/30">
                <td className={cell} />
                <td className={`${cell} text-xs font-semibold text-slate-500 dark:text-slate-400`}>{p.label} total</td>
                <td className={`${cell} text-right text-xs tabular-nums text-slate-500`}>
                  {p.rows.reduce((s, r) => s + r.count, 0)}
                </td>
                {showQty && <td className={cell} />}
                <td className={`${cell} text-right text-xs font-semibold tabular-nums text-navy-900 dark:text-slate-100`}>
                  {fmt(p.rows.reduce((s, r) => s + r.amount, 0))}
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
      {report.rows.length > 0 && (
        <tfoot>
          <tr className="border-t-2 border-slate-300 font-semibold text-navy-950 dark:border-navy-600 dark:text-white">
            <td className={cell} colSpan={grouped ? 2 : 1}>
              Grand Total
            </td>
            <td className={`${cell} text-right tabular-nums`}>{report.total_count}</td>
            {showQty && <td className={`${cell} text-right tabular-nums`}>{qty(report.total_quantity, report.total_unit)}</td>}
            <td className={`${cell} text-right tabular-nums`}>{fmt(report.total_amount)}</td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
