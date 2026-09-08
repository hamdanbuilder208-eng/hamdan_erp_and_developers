import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Landmark,
  Wallet,
} from "lucide-react";
import { portalApi } from "../../lib/portalApi";
import { Card, CardContent } from "../../components/ui/Card";
import { BookingStatusBadge } from "../../components/ui/Badge";
import type { Booking } from "../../types";

const todayIso = () => new Date().toISOString().slice(0, 10);

function bookingSummary(booking: Booking) {
  const paid = booking.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0);
  const outstanding = Number(booking.total_price) - paid;
  const percentPaid = Number(booking.total_price) > 0 ? (paid / Number(booking.total_price)) * 100 : 0;
  const nextDue = booking.schedule_lines
    .slice()
    .sort((a, b) => a.installment_no - b.installment_no)
    .find((l) => Number(l.paid_amount) < Number(l.amount));
  const isOverdue = nextDue ? nextDue.due_date < todayIso() : false;
  return { paid, outstanding, percentPaid, nextDue, isOverdue };
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "brand" | "success" | "danger";
}) {
  const toneClasses = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-300",
    success: "bg-success-50 text-success-600 dark:bg-success-100 dark:text-success-700",
    danger: "bg-danger-50 text-danger-600 dark:bg-danger-100 dark:text-danger-700",
  }[tone];

  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-0.5 truncate text-base font-semibold text-navy-950 dark:text-white">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CustomerDashboardPage() {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["portal-bookings"],
    queryFn: async () => (await portalApi.get<Booking[]>("/portal/me/bookings")).data,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-navy-800" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-900/30 dark:text-brand-300">
            <Building2 className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-navy-800 dark:text-slate-200">
            No bookings found on your account yet
          </p>
          <p className="max-w-xs text-xs text-slate-500 dark:text-slate-400">
            Once your unit booking is recorded by our sales office, it will show up here with your
            payment schedule and receipts.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totals = bookings.reduce(
    (acc, b) => {
      const { paid, outstanding } = bookingSummary(b);
      return {
        totalPrice: acc.totalPrice + Number(b.total_price),
        paid: acc.paid + paid,
        outstanding: acc.outstanding + outstanding,
      };
    },
    { totalPrice: 0, paid: 0, outstanding: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          icon={Landmark}
          label="Total Investment"
          value={`PKR ${totals.totalPrice.toLocaleString()}`}
          tone="brand"
        />
        <StatTile
          icon={CheckCircle2}
          label="Paid To-Date"
          value={`PKR ${totals.paid.toLocaleString()}`}
          tone="success"
        />
        <StatTile
          icon={Wallet}
          label="Outstanding"
          value={`PKR ${totals.outstanding.toLocaleString()}`}
          tone="danger"
        />
      </div>

      {bookings.map((booking) => {
        const { paid, outstanding, percentPaid, nextDue, isOverdue } = bookingSummary(booking);
        return (
          <Card key={booking.id}>
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-navy-800">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-navy-800 dark:text-slate-400">
                  <Building2 className="h-4.5 w-4.5" />
                </div>
                <div>
                  <p className="font-mono text-xs text-slate-400 dark:text-slate-500">
                    {booking.booking_ref_no}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-navy-950 dark:text-white">
                    {booking.project.project_name} · Unit {booking.unit.unit_number}
                  </p>
                </div>
              </div>
              <BookingStatusBadge status={booking.status} />
            </div>

            <CardContent className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Payment progress</span>
                  <span className="font-medium text-navy-800 dark:text-slate-200">
                    {percentPaid.toFixed(0)}% paid
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${Math.min(percentPaid, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Total Price</p>
                  <p className="mt-0.5 font-medium text-navy-900 dark:text-slate-100">
                    PKR {Number(booking.total_price).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Paid To-Date</p>
                  <p className="mt-0.5 font-medium text-success-700">PKR {paid.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding Balance</p>
                  <p className="mt-0.5 font-medium text-danger-600">
                    PKR {outstanding.toLocaleString()}
                  </p>
                </div>
              </div>

              {nextDue && (
                <div
                  className={`flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm ${
                    isOverdue
                      ? "bg-danger-50 dark:bg-danger-100/10"
                      : "bg-brand-50 dark:bg-brand-900/20"
                  }`}
                >
                  {isOverdue ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-danger-600 dark:text-danger-500" />
                  ) : (
                    <Clock className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
                  )}
                  <div>
                    <span className={isOverdue ? "text-danger-700 dark:text-danger-500" : "text-brand-700 dark:text-brand-300"}>
                      {isOverdue ? "Overdue" : "Next Due"} — {nextDue.label}:{" "}
                    </span>
                    <span className={`font-semibold ${isOverdue ? "text-danger-800 dark:text-danger-500" : "text-brand-900 dark:text-brand-200"}`}>
                      PKR {(Number(nextDue.amount) - Number(nextDue.paid_amount)).toLocaleString()}
                    </span>
                    <span className={`ml-1 ${isOverdue ? "text-danger-700 dark:text-danger-500" : "text-brand-700 dark:text-brand-300"}`}>
                      on {nextDue.due_date}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Payment Schedule
                </p>
                <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-navy-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">Label</th>
                        <th className="px-3 py-2 font-medium">Due Date</th>
                        <th className="px-3 py-2 text-right font-medium">Amount</th>
                        <th className="px-3 py-2 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                      {booking.schedule_lines.map((line) => {
                        const linePaid = Number(line.paid_amount) >= Number(line.amount);
                        const lineOverdue = !linePaid && line.due_date < todayIso();
                        return (
                          <tr key={line.id}>
                            <td className="px-3 py-2 text-navy-800 dark:text-slate-200">{line.label}</td>
                            <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{line.due_date}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                              {Number(line.amount).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {linePaid ? (
                                <span className="inline-flex items-center gap-1 text-success-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Paid
                                </span>
                              ) : lineOverdue ? (
                                <span className="inline-flex items-center gap-1 text-danger-600">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  Overdue
                                </span>
                              ) : (
                                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                                  {Number(line.paid_amount).toLocaleString()} of{" "}
                                  {Number(line.amount).toLocaleString()}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
