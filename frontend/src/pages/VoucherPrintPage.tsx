import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, Voucher } from "../types";

const VOUCHER_TERMS = [
  "This voucher is recorded in the company's official books as per the accounts and amounts stated above.",
  "This voucher is valid only when signed by the preparer and an authorized signatory.",
  "Any correction or reversal of this entry must be authorized in writing by management.",
  "In case of any discrepancy, the company's official accounts and records shall prevail.",
];

export default function VoucherPrintPage() {
  const { id } = useParams();

  const { data: voucher, isLoading } = useQuery({
    queryKey: ["voucher", id],
    queryFn: async () => (await api.get<Voucher>(`/vouchers/${id}`)).data,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

  if (isLoading || !voucher) {
    return <div className="p-10 text-sm text-slate-400">Loading voucher...</div>;
  }

  const totalDebit = voucher.lines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCredit = voucher.lines.reduce((s, l) => s + Number(l.credit), 0);

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
            <p className="text-lg font-bold text-navy-950">
              {companySettings?.company_name ?? "Hamdan Builders and Developers"}
            </p>
            <p className="text-xs text-slate-500">Real Estate Builder &amp; Developer</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">
              {voucher.voucher_type} Voucher
            </p>
            <p className="mt-1 font-mono text-sm text-slate-500">{voucher.voucher_no}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 py-5 text-sm">
          <div>
            <p className="text-xs text-slate-500">Date</p>
            <p className="mt-0.5 font-medium text-navy-900">{voucher.voucher_date}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Narration</p>
            <p className="mt-0.5 font-medium text-navy-900">{voucher.narration || "—"}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 print:bg-slate-50">
              <th className="px-3 py-2 font-semibold text-slate-600">Account Code</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Account Name</th>
              <th className="px-3 py-2 font-semibold text-slate-600">Narration</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Debit</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-600">Credit</th>
            </tr>
          </thead>
          <tbody>
            {voucher.lines.map((line) => (
              <tr key={line.id} className="border-b border-slate-100">
                <td className="px-3 py-2 font-mono text-xs text-slate-500">{line.account.code}</td>
                <td className="px-3 py-2 text-navy-900">{line.account.name}</td>
                <td className="px-3 py-2 text-slate-500">{line.narration || "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900">
                  {Number(line.debit) > 0 ? Number(line.debit).toLocaleString() : ""}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900">
                  {Number(line.credit) > 0 ? Number(line.credit).toLocaleString() : ""}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
              <td colSpan={3} className="px-3 py-2 text-right">
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums">PKR {totalDebit.toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums">PKR {totalCredit.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Terms &amp; Conditions
          </p>
          <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-relaxed text-slate-500">
            {VOUCHER_TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>
        </div>

        <div className="mt-10 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">Prepared By</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">Received By</div>
        </div>
      </div>
    </div>
  );
}
