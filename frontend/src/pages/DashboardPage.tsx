import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Boxes,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  Handshake,
  Home,
  Landmark,
  MapPin,
  TrendingUp,
  Users,
  Wallet2,
} from "lucide-react";
import { api } from "../lib/api";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Select } from "../components/ui/Input";
import { DonutChart } from "../components/charts/DonutChart";
import { ColumnChart } from "../components/charts/ColumnChart";
import { RankedBarChart } from "../components/charts/RankedBarChart";
import { LineChart } from "../components/charts/LineChart";
import { FunnelChart } from "../components/charts/FunnelChart";
import { StatCardSkeleton, ChartSkeleton, BarsSkeleton } from "../components/ui/Skeleton";
import type {
  Booking,
  BrokerSummaryRow,
  CustomerWiseReport,
  LandProperty,
  OfficeExpense,
  OwnerPersonalExpense,
  PartnerSummaryRow,
  Project,
  Receipt,
  StockBalance,
  Unit,
  UnitStatus,
  LandPropertyStatus,
  WagePayment,
} from "../types";

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone: "brand" | "success" | "warning" | "info";
}) {
  const toneClasses: Record<typeof tone, string> = {
    brand: "from-brand-500 to-brand-600 shadow-brand-500/30",
    success: "from-success-500 to-success-600 shadow-success-500/30",
    warning: "from-warning-500 to-warning-600 shadow-warning-500/30",
    info: "from-info-500 to-info-600 shadow-info-500/30",
  };
  return (
    <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-center gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${toneClasses[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-navy-950 dark:text-white">{value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const unitStatusOrder: UnitStatus[] = ["Available", "Booked", "Sold", "On-Hold", "Cancelled"];
const unitStatusColorVar: Record<UnitStatus, string> = {
  Available: "var(--color-success-500)",
  Booked: "var(--color-warning-500)",
  Sold: "var(--color-info-500)",
  "On-Hold": "var(--color-onhold-500)",
  Cancelled: "var(--color-danger-500)",
};

const landStatusOrder: LandPropertyStatus[] = ["Available", "Reserved", "Sold"];
const landStatusColorVar: Record<LandPropertyStatus, string> = {
  Available: "var(--color-success-500)",
  Reserved: "var(--color-warning-500)",
  Sold: "var(--color-info-500)",
};

const materialColorPalette = [
  "var(--color-brand-500)",
  "var(--color-info-500)",
  "var(--color-success-500)",
  "var(--color-warning-500)",
  "var(--color-onhold-500)",
  "var(--color-danger-500)",
];

const projectColorPalette = materialColorPalette;

const isCurrentMonth = (isoDate: string) => {
  const d = new Date(isoDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function sumByMonth(entries: { date: string; amount: number }[], year: number): number[] {
  const totals = new Array(12).fill(0);
  for (const e of entries) {
    const d = new Date(e.date);
    if (d.getFullYear() === year) totals[d.getMonth()] += e.amount;
  }
  return totals;
}

export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: pendingCheques, isLoading: chequesLoading } = useQuery({
    queryKey: ["pending-cheques"],
    queryFn: async () => (await api.get<Receipt[]>("/receipts/cheques/pending")).data,
  });

  const updateChequeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "Cleared" | "Bounced" }) =>
      (await api.patch<Receipt>(`/receipts/${id}/cheque-status`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-cheques"] });
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to update cheque status."));
    },
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });

  const { data: units, isLoading: unitsLoading } = useQuery({
    queryKey: ["units", "all"],
    queryFn: async () => (await api.get<Unit[]>("/units/")).data,
  });

  const { data: landProperties, isLoading: landLoading } = useQuery({
    queryKey: ["land-properties", "all"],
    queryFn: async () => (await api.get<LandProperty[]>("/land-properties/")).data,
  });

  const { data: stock, isLoading: stockLoading } = useQuery({
    queryKey: ["stock", "all"],
    queryFn: async () => (await api.get<StockBalance[]>("/inventory/stock")).data,
  });

  const { data: officeExpenses, isLoading: officeLoading } = useQuery({
    queryKey: ["office-expenses"],
    queryFn: async () => (await api.get<OfficeExpense[]>("/expenses/office")).data,
  });

  const { data: wagePayments, isLoading: wagesLoading } = useQuery({
    queryKey: ["wage-payments"],
    queryFn: async () => (await api.get<WagePayment[]>("/expenses/wages")).data,
  });

  const { data: ownerExpenses, isLoading: ownerLoading } = useQuery({
    queryKey: ["owner-expenses"],
    queryFn: async () => (await api.get<OwnerPersonalExpense[]>("/expenses/owner-personal")).data,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => (await api.get<Booking[]>("/bookings/")).data,
  });

  const { data: receipts, isLoading: receiptsLoading } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => (await api.get<Receipt[]>("/receipts/")).data,
  });

  const [trendYear, setTrendYear] = React.useState(new Date().getFullYear());

  const { data: brokers, isLoading: brokersLoading } = useQuery({
    queryKey: ["reports", "brokers"],
    queryFn: async () => (await api.get<BrokerSummaryRow[]>("/reports/brokers")).data,
  });

  const { data: partnersSummary, isLoading: partnersLoading } = useQuery({
    queryKey: ["reports", "partners"],
    queryFn: async () => (await api.get<PartnerSummaryRow[]>("/reports/partners")).data,
  });

  const { data: customerWiseReport, isLoading: customerWiseLoading } = useQuery({
    queryKey: ["reports", "customer-wise"],
    queryFn: async () => (await api.get<CustomerWiseReport>("/reports/customer-wise")).data,
  });

  const statsLoading = projectsLoading || unitsLoading;
  const expenseLoading = officeLoading || wagesLoading || ownerLoading;
  const trendLoading = bookingsLoading || receiptsLoading || expenseLoading;
  const projectRevenueLoading = bookingsLoading || projectsLoading;

  const activeProjects = projects?.filter((p) => p.status === "Active").length ?? 0;
  const totalUnits = units?.length ?? 0;
  const availableUnits = units?.filter((u) => u.status === "Available").length ?? 0;
  const bookedUnits = units?.filter((u) => u.status === "Booked" || u.status === "Sold").length ?? 0;

  const unitChartData = unitStatusOrder.map((status) => ({
    label: status,
    value: units?.filter((u) => u.status === status).length ?? 0,
    colorVar: unitStatusColorVar[status],
  }));

  const landChartData = landStatusOrder.map((status) => ({
    label: status,
    value: landProperties?.filter((p) => p.status === status).length ?? 0,
    colorVar: landStatusColorVar[status],
  }));

  const hasUnits = totalUnits > 0;
  const hasLand = (landProperties?.length ?? 0) > 0;

  const materialValueMap = new Map<string, number>();
  for (const s of stock ?? []) {
    materialValueMap.set(s.material_name, (materialValueMap.get(s.material_name) ?? 0) + s.balance_value);
  }
  const materialChartData = Array.from(materialValueMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value], i) => ({
      label,
      value: Math.round(value),
      colorVar: materialColorPalette[i % materialColorPalette.length],
    }));
  const totalStockValue = materialChartData.reduce((sum, d) => sum + d.value, 0);
  const hasStock = materialChartData.length > 0;

  const officeTotal = (officeExpenses ?? [])
    .filter((e) => isCurrentMonth(e.expense_date))
    .reduce((sum, e) => sum + e.amount, 0);
  const wagesTotal = (wagePayments ?? [])
    .filter((w) => isCurrentMonth(w.payment_date))
    .reduce((sum, w) => sum + w.net_paid, 0);
  const ownerTotal = (ownerExpenses ?? [])
    .filter((e) => isCurrentMonth(e.expense_date))
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = officeTotal + wagesTotal + ownerTotal;
  const hasExpense = totalExpense > 0;

  const expenseCategoryMap = new Map<string, number>();
  for (const e of officeExpenses ?? []) {
    if (!isCurrentMonth(e.expense_date)) continue;
    expenseCategoryMap.set(e.expense_head.name, (expenseCategoryMap.get(e.expense_head.name) ?? 0) + e.amount);
  }
  if (wagesTotal > 0) {
    expenseCategoryMap.set("Salary / Wages", (expenseCategoryMap.get("Salary / Wages") ?? 0) + wagesTotal);
  }
  for (const e of ownerExpenses ?? []) {
    if (!isCurrentMonth(e.expense_date)) continue;
    expenseCategoryMap.set(e.category, (expenseCategoryMap.get(e.category) ?? 0) + e.amount);
  }
  const expenseChartData = Array.from(expenseCategoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i) => ({
      label,
      value: Math.round(value),
      colorVar: materialColorPalette[i % materialColorPalette.length],
    }));

  const revenueByProject = new Map<number, number>();
  for (const b of bookings ?? []) {
    if (b.status === "Cancelled") continue;
    revenueByProject.set(b.project_id, (revenueByProject.get(b.project_id) ?? 0) + Number(b.total_price));
  }
  const projectChartData = (projects ?? [])
    .filter((p) => (revenueByProject.get(p.id) ?? 0) > 0)
    .map((p, i) => ({
      label: p.project_name,
      value: revenueByProject.get(p.id) ?? 0,
      colorVar: projectColorPalette[i % projectColorPalette.length],
    }));
  const hasProjectRevenue = projectChartData.length > 0;

  const availableYears = Array.from(
    new Set(
      [
        ...(bookings ?? []).map((b) => new Date(b.booking_date).getFullYear()),
        ...(receipts ?? []).map((r) => new Date(r.receipt_date).getFullYear()),
        ...(officeExpenses ?? []).map((e) => new Date(e.expense_date).getFullYear()),
        ...(wagePayments ?? []).map((w) => new Date(w.payment_date).getFullYear()),
        ...(ownerExpenses ?? []).map((e) => new Date(e.expense_date).getFullYear()),
      ].filter((y) => !Number.isNaN(y)),
    ),
  ).sort((a, b) => b - a);
  const yearOptions = availableYears.length > 0 ? availableYears : [new Date().getFullYear()];

  const salesByMonth = sumByMonth(
    (bookings ?? [])
      .filter((b) => b.status !== "Cancelled")
      .map((b) => ({ date: b.booking_date, amount: Number(b.total_price) })),
    trendYear,
  );
  const cashInByMonth = sumByMonth(
    (receipts ?? []).map((r) => ({ date: r.receipt_date, amount: Number(r.amount) })),
    trendYear,
  );
  const cashOutByMonth = sumByMonth(
    [
      ...(officeExpenses ?? []).map((e) => ({ date: e.expense_date, amount: e.amount })),
      ...(wagePayments ?? []).map((w) => ({ date: w.payment_date, amount: w.net_paid })),
      ...(ownerExpenses ?? []).map((e) => ({ date: e.expense_date, amount: e.amount })),
    ],
    trendYear,
  );
  const trendSeries = [
    { label: "Sales", colorVar: "var(--color-brand-500)", data: salesByMonth },
    { label: "Cash In (Receipts)", colorVar: "var(--color-success-500)", data: cashInByMonth },
    { label: "Cash Out (Expenses)", colorVar: "var(--color-danger-500)", data: cashOutByMonth },
  ];
  const hasTrendData = [...salesByMonth, ...cashInByMonth, ...cashOutByMonth].some((v) => v > 0);

  const bookedCount = units?.filter((u) => u.status === "Booked").length ?? 0;
  const soldCount = units?.filter((u) => u.status === "Sold").length ?? 0;
  const funnelStages = [
    { label: "Total Units", value: totalUnits, colorVar: "var(--color-slate-400, #94a3b8)" },
    { label: "Booked or Sold", value: bookedCount + soldCount, colorVar: "var(--color-warning-500)" },
    { label: "Sold", value: soldCount, colorVar: "var(--color-success-500)" },
  ];

  const brokerChartData = (brokers ?? [])
    .filter((b) => b.total_eligible > 0)
    .map((b, i) => ({
      label: b.name,
      value: b.total_eligible,
      colorVar: materialColorPalette[i % materialColorPalette.length],
    }));
  const hasBrokerData = brokerChartData.length > 0;

  const partnerChartData = (partnersSummary ?? [])
    .filter((p) => p.total_share_amount > 0)
    .map((p, i) => ({
      label: p.name,
      value: p.total_share_amount,
      colorVar: materialColorPalette[i % materialColorPalette.length],
    }));
  const hasPartnerData = partnerChartData.length > 0;

  const partnerDistributableChartData = (partnersSummary ?? [])
    .filter((p) => p.total_distributable_share > 0)
    .map((p, i) => ({
      label: p.name,
      value: p.total_distributable_share,
      colorVar: materialColorPalette[i % materialColorPalette.length],
    }));
  const hasPartnerDistributableData = partnerDistributableChartData.length > 0;

  const customerChartData = (customerWiseReport?.rows ?? [])
    .filter((r) => r.total_booked > 0)
    .slice(0, 8)
    .map((r, i) => ({
      label: r.name,
      value: r.total_booked,
      colorVar: materialColorPalette[i % materialColorPalette.length],
    }));
  const hasCustomerData = customerChartData.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Active Projects" value={activeProjects} icon={Building2} tone="brand" />
            <StatCard label="Total Units" value={totalUnits} icon={Home} tone="info" />
            <StatCard label="Available Units" value={availableUnits} icon={CheckCircle2} tone="success" />
            <StatCard label="Booked / Sold" value={bookedUnits} icon={Clock} tone="warning" />
          </>
        )}
      </div>

      {!chequesLoading && pendingCheques && pendingCheques.length > 0 && (
        <Card className="border-warning-200 bg-warning-50/40 dark:border-warning-900/40 dark:bg-warning-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning-600" />
              Cheque Reminders — Confirm Cleared or Bounced
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingCheques.map((r) => {
              const today = new Date().toISOString().slice(0, 10);
              const isToday = r.cheque_clearing_date === today;
              const overdue = !!r.cheque_clearing_date && r.cheque_clearing_date < today;
              const daysOverdue = overdue
                ? Math.round(
                    (new Date(today).getTime() - new Date(r.cheque_clearing_date!).getTime()) /
                      86400000,
                  )
                : 0;
              const statusLine = isToday
                ? "This cheque was due to be cashed today — was it?"
                : overdue
                  ? `This cheque was due to be cashed ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} ago — still pending!`
                  : `Due to be cashed on ${r.cheque_clearing_date}`;
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-4 py-2.5 dark:border-navy-800 dark:bg-navy-900"
                >
                  <div>
                    <p className="text-sm font-medium text-navy-900 dark:text-slate-100">
                      {r.booking.allottee.name}{" "}
                      <span className="font-normal text-slate-400 dark:text-slate-500">
                        · {r.booking.booking_ref_no}
                        {r.cheque_no ? ` · Cheque #${r.cheque_no}` : ""}
                      </span>
                    </p>
                    <p
                      className={`text-xs ${
                        overdue || isToday
                          ? "font-medium text-danger-600"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {statusLine} — PKR {Number(r.amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateChequeStatus.mutate({ id: r.id, status: "Cleared" })}
                    >
                      Mark Cleared
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        const ok = await confirm(
                          `Mark cheque ${r.cheque_no ?? ""} as bounced? This will reverse the payment.`,
                          { danger: true, confirmLabel: "Mark Bounced" },
                        );
                        if (ok) updateChequeStatus.mutate({ id: r.id, status: "Bounced" });
                      }}
                    >
                      Mark Bounced
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Units by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {unitsLoading ? (
              <ChartSkeleton />
            ) : hasUnits ? (
              <DonutChart data={unitChartData} total={totalUnits} centerLabel="Units" />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No units yet. Generate units under Projects &amp; Units.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Land / Plots by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {landLoading ? (
              <BarsSkeleton />
            ) : hasLand ? (
              <ColumnChart data={landChartData} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No land/plot inventory yet. Add one under Land / Plots.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Material Inventory — Stock Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stockLoading ? (
              <ChartSkeleton />
            ) : hasStock ? (
              <DonutChart
                data={materialChartData}
                total={totalStockValue}
                formatValue={(v) => `PKR ${v.toLocaleString()}`}
                centerLabel="Stock Value"
              />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No stock yet. Receive material under Material &amp; Inventory.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Wallet2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Expense Management — This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseLoading ? (
              <ChartSkeleton />
            ) : hasExpense ? (
              <DonutChart
                data={expenseChartData}
                total={totalExpense}
                formatValue={(v) => `PKR ${v.toLocaleString()}`}
                centerLabel="This Month"
              />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No expenses recorded this month yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Monthly Sales &amp; Cash Flow
            </CardTitle>
            <Select
              value={trendYear}
              onChange={(e) => setTrendYear(Number(e.target.value))}
              className="w-24"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <BarsSkeleton />
            ) : hasTrendData ? (
              <LineChart
                series={trendSeries}
                xLabels={monthLabels}
                formatValue={(v) => `PKR ${v.toLocaleString()}`}
              />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No sales or cash flow data for {trendYear} yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Project-wise Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projectRevenueLoading ? (
              <BarsSkeleton />
            ) : hasProjectRevenue ? (
              <RankedBarChart data={projectChartData} formatValue={(v) => `PKR ${v.toLocaleString()}`} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No booking revenue yet. Create a booking under Unit Booking.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Unit Sales Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unitsLoading ? (
              <BarsSkeleton />
            ) : hasUnits ? (
              <FunnelChart stages={funnelStages} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No units yet. Generate units under Projects &amp; Units.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Handshake className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Broker Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {brokersLoading ? (
              <BarsSkeleton />
            ) : hasBrokerData ? (
              <RankedBarChart data={brokerChartData} formatValue={(v) => `PKR ${v.toLocaleString()}`} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No broker commission earned yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Partner Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {partnersLoading ? (
              <BarsSkeleton />
            ) : hasPartnerData ? (
              <RankedBarChart data={partnerChartData} formatValue={(v) => `PKR ${v.toLocaleString()}`} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No partner profit share earned yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Landmark className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Partner Pool — Available to Distribute Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            {partnersLoading ? (
              <BarsSkeleton />
            ) : hasPartnerDistributableData ? (
              <RankedBarChart
                data={partnerDistributableChartData}
                formatValue={(v) => `PKR ${v.toLocaleString()}`}
              />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                Nothing safe to distribute yet — revenue collected hasn't crossed the
                construction reserve for any project.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              Top Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {customerWiseLoading ? (
              <BarsSkeleton />
            ) : hasCustomerData ? (
              <RankedBarChart data={customerChartData} formatValue={(v) => `PKR ${v.toLocaleString()}`} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No customer bookings yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasUnits && !hasLand && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Welcome to Hamdan ERP. Start by setting up your first project under{" "}
              <span className="font-medium text-navy-800 dark:text-slate-200">Projects &amp; Units</span>.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
