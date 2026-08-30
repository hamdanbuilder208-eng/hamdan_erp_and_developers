import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { portalApi } from "../../lib/portalApi";
import { Card, CardContent } from "../../components/ui/Card";
import { BookingStatusBadge } from "../../components/ui/Badge";
import type { Booking } from "../../types";

function bookingSummary(booking: Booking) {
  const paid = booking.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0);
  const outstanding = Number(booking.total_price) - paid;
  const nextDue = booking.schedule_lines
    .slice()
    .sort((a, b) => a.installment_no - b.installment_no)
    .find((l) => Number(l.paid_amount) < Number(l.amount));
  return { paid, outstanding, nextDue };
}

export default function CustomerDashboardPage() {
  const { data: bookings, isLoading } = useQuery({
    queryKey: ["portal-bookings"],
    queryFn: async () => (await portalApi.get<Booking[]>("/portal/me/bookings")).data,
  });

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading your bookings...</p>;
  }

  if (!bookings || bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          No bookings found on your account yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {bookings.map((booking) => {
        const { paid, outstanding, nextDue } = bookingSummary(booking);
        return (
          <Card key={booking.id}>
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-navy-800">
              <div>
                <p className="font-mono text-xs text-slate-400 dark:text-slate-500">
                  {booking.booking_ref_no}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-navy-950 dark:text-white">
                  {booking.project.project_name} · Unit {booking.unit.unit_number}
                </p>
              </div>
              <BookingStatusBadge status={booking.status} />
            </div>

            <CardContent className="space-y-4">
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
                <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm dark:bg-brand-900/20">
                  <span className="text-brand-700 dark:text-brand-300">Next Due — {nextDue.label}: </span>
                  <span className="font-semibold text-brand-900 dark:text-brand-200">
                    PKR {(Number(nextDue.amount) - Number(nextDue.paid_amount)).toLocaleString()}
                  </span>
                  <span className="ml-1 text-brand-700 dark:text-brand-300">on {nextDue.due_date}</span>
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
                        <th className="px-3 py-2 text-right font-medium">Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                      {booking.schedule_lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-3 py-2 text-navy-800 dark:text-slate-200">{line.label}</td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{line.due_date}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                            {Number(line.amount).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                            {Number(line.paid_amount) >= Number(line.amount) ? (
                              <span className="text-success-700">Paid</span>
                            ) : (
                              Number(line.paid_amount).toLocaleString()
                            )}
                          </td>
                        </tr>
                      ))}
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
