import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { portalApi } from "../../lib/portalApi";
import { Card } from "../../components/ui/Card";
import type { Receipt } from "../../types";

export default function CustomerReceiptsPage() {
  const { data: receipts, isLoading } = useQuery({
    queryKey: ["portal-receipts"],
    queryFn: async () => (await portalApi.get<Receipt[]>("/portal/me/receipts")).data,
  });

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <tr>
            <th className="px-5 py-3 font-medium">Receipt #</th>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Booking</th>
            <th className="px-5 py-3 font-medium">Mode</th>
            <th className="px-5 py-3 text-right font-medium">Amount</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
          {isLoading && (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                Loading...
              </td>
            </tr>
          )}
          {!isLoading && receipts?.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                No receipts on your account yet.
              </td>
            </tr>
          )}
          {receipts?.map((r) => (
            <tr key={r.id}>
              <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                {r.receipt_no}
              </td>
              <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.receipt_date}</td>
              <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{r.booking.booking_ref_no}</td>
              <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.mode_of_payment}</td>
              <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                PKR {Number(r.amount).toLocaleString()}
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => window.open(`/portal/receipts/${r.id}/print`, "_blank")}
                  title="Print"
                  className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                >
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
