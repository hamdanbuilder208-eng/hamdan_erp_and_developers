import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, GeneralLedgerReport } from "../types";

export default function GeneralLedgerPrintPage() {
  const { accountId } = useParams();

  const { data } = useQuery({
    queryKey: ["reports", "general-ledger", accountId],
    queryFn: async () =>
      (await api.get<GeneralLedgerReport>(`/reports/general-ledger/${accountId}`)).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (!data) {
    return <div className="p-10 text-sm text-slate-400">Loading ledger...</div>;
  }

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
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">General Ledger</p>
            <p className="mt-1 text-sm text-slate-500">
              {data.account_code} · {data.account_name}
            </p>
          </div>
        </div>

        <table className="mt-5 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Date</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Voucher</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Narration</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Debit</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Credit</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <td colSpan={5} className="px-3 py-2 text-slate-500">
                Opening Balance
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {data.opening_balance.toLocaleString()}
              </td>
            </tr>
            {data.lines.map((l, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-3 py-2 text-slate-500">{l.voucher_date}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{l.voucher_no}</td>
                <td className="px-3 py-2 text-slate-500">{l.narration || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {l.debit ? l.debit.toLocaleString() : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {l.credit ? l.credit.toLocaleString() : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-navy-900">
                  {l.running_balance.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
              <td colSpan={5} className="px-3 py-2 text-right">
                Closing Balance
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{data.closing_balance.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-16 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Approved By</div>
        </div>
      </div>
    </div>
  );
}
