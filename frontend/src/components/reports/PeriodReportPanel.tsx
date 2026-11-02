import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, RotateCcw } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { Input, Label, Select } from "../ui/Input";
import type { PeriodReport, PeriodReportCategory, PeriodReportGroupBy, PeriodReportPeriod } from "../../types";
import {
  PERIOD_CATEGORIES,
  PERIODS,
  PeriodReportTable,
  categoryInfo,
  groupByLabel,
  periodReportParams,
  type PeriodReportFilters,
} from "./PeriodReportTable";

const todayIso = () => new Date().toISOString().slice(0, 10);
const startOfYearIso = () => `${new Date().getFullYear()}-01-01`;

/**
 * Any one category totalled per day / week / month / year — e.g. cement bags
 * bought in cash for one project, month by month. The project comes from the
 * Reports page's own project filter.
 */
export function PeriodReportPanel({ projectId, projectLabel }: { projectId: string; projectLabel: string }) {
  const [filters, setFilters] = React.useState<Omit<PeriodReportFilters, "project_id">>({
    category: "material_purchases",
    period: "month",
    date_from: startOfYearIso(),
    date_to: todayIso(),
    item: "",
    payment_mode: "",
    party: "",
    group_by: "",
  });
  const set = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch }));
  const all: PeriodReportFilters = { ...filters, project_id: projectId };
  const info = categoryInfo(filters.category);

  const { data: report, isFetching } = useQuery({
    queryKey: ["reports", "period", all],
    queryFn: async () => (await api.get<PeriodReport>("/reports/period", { params: periodReportParams(all) })).data,
    placeholderData: (prev) => prev,
  });

  const groupOptions: PeriodReportGroupBy[] = ["project", "item", "payment_mode", "party"];

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-navy-800">
        <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
          {info.label} — {PERIODS.find((p) => p.key === filters.period)?.label} {projectLabel}
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => set({ item: "", payment_mode: "", party: "", group_by: "" })}
          >
            <RotateCcw className="h-4 w-4" />
            Clear Filters
          </Button>
          <Button
            size="sm"
            onClick={() =>
              window.open(`/reports/print/period?${new URLSearchParams(periodReportParams(all))}`, "_blank")
            }
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-4 dark:border-navy-800">
        <div>
          <Label htmlFor="pr_category">Category</Label>
          <Select
            id="pr_category"
            value={filters.category}
            // Item / party / mode choices differ per category, so reset them.
            onChange={(e) =>
              set({ category: e.target.value as PeriodReportCategory, item: "", party: "", payment_mode: "" })
            }
          >
            {PERIOD_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pr_period">Report</Label>
          <Select
            id="pr_period"
            value={filters.period}
            onChange={(e) => set({ period: e.target.value as PeriodReportPeriod })}
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pr_from">From</Label>
          <Input id="pr_from" type="date" value={filters.date_from} onChange={(e) => set({ date_from: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="pr_to">To</Label>
          <Input id="pr_to" type="date" value={filters.date_to} onChange={(e) => set({ date_to: e.target.value })} />
        </div>

        <div>
          <Label htmlFor="pr_item">{info.itemLabel}</Label>
          <Select id="pr_item" value={filters.item} onChange={(e) => set({ item: e.target.value })}>
            <option value="">All</option>
            {report?.items.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pr_mode">Payment Mode</Label>
          <Select id="pr_mode" value={filters.payment_mode} onChange={(e) => set({ payment_mode: e.target.value })}>
            <option value="">All</option>
            {report?.payment_modes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pr_party">{info.partyLabel}</Label>
          <Select id="pr_party" value={filters.party} onChange={(e) => set({ party: e.target.value })}>
            <option value="">All</option>
            {report?.parties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pr_group">Split By</Label>
          <Select
            id="pr_group"
            value={filters.group_by}
            onChange={(e) => set({ group_by: e.target.value as PeriodReportFilters["group_by"] })}
          >
            <option value="">— Totals only —</option>
            {groupOptions.map((g) => (
              <option key={g} value={g}>
                {groupByLabel(filters.category, g)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {(filters.category === "material_purchases" || filters.category === "material_issues") &&
        !filters.item &&
        filters.group_by !== "item" && (
          <p className="border-b border-slate-100 px-5 py-2 text-xs text-slate-500 dark:border-navy-800 dark:text-slate-400">
            Pick one material (or split by Material) to see quantities — different materials are in different units.
          </p>
        )}

      <CardContent className={`p-0 ${isFetching ? "opacity-60" : ""}`}>
        {report ? (
          <PeriodReportTable report={report} />
        ) : (
          <p className="px-5 py-10 text-center text-sm text-slate-400">Loading...</p>
        )}
      </CardContent>
    </Card>
  );
}
