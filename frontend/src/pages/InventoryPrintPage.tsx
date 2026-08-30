import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { AccountantSignature } from "../components/print/SignatureBlock";
import type { CompanySettings, GRN, MaterialIssue, PurchaseOrder } from "../types";

function PrintShell({
  title,
  refNo,
  date,
  statusLabel,
  children,
  footerLeft,
  footerRight,
}: {
  title: string;
  refNo: string;
  date: string;
  statusLabel: string;
  children: React.ReactNode;
  footerLeft: string;
  footerRight: string;
}) {
  const { data: companySettings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await api.get<CompanySettings>("/admin/settings")).data,
  });

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
            <p className="text-xl font-bold uppercase tracking-wide text-navy-950">{title}</p>
            <p className="mt-1 font-mono text-sm text-slate-500">{refNo}</p>
            <p className="text-xs text-slate-400">{date}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              {statusLabel}
            </p>
          </div>
        </div>
        <div className="py-5">{children}</div>
        <div className="mt-16 grid grid-cols-3 gap-6 text-center text-xs text-slate-500">
          <div className="border-t border-slate-300 pt-2">{footerLeft}</div>
          <AccountantSignature settings={companySettings} />
          <div className="border-t border-slate-300 pt-2">{footerRight}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-navy-900">{value}</span>
    </div>
  );
}

function LinesTable({
  lines,
  showRate,
}: {
  lines: { id: number; material: { name: string; unit_of_measure: string }; quantity: number; rate: number; amount: number }[];
  showRate: boolean;
}) {
  const total = lines.reduce((s, l) => s + Number(l.amount), 0);
  return (
    <table className="mt-3 w-full border-collapse text-left text-sm">
      <thead>
        <tr className="border-y border-slate-300 bg-slate-50 print:bg-slate-50">
          <th className="px-3 py-2 font-semibold text-slate-600">Material</th>
          <th className="px-3 py-2 text-right font-semibold text-slate-600">Quantity</th>
          {showRate && <th className="px-3 py-2 text-right font-semibold text-slate-600">Rate</th>}
          <th className="px-3 py-2 text-right font-semibold text-slate-600">Amount</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id} className="border-b border-slate-100">
            <td className="px-3 py-2 text-navy-900">{line.material.name}</td>
            <td className="px-3 py-2 text-right tabular-nums text-navy-900">
              {Number(line.quantity).toLocaleString()} {line.material.unit_of_measure}
            </td>
            {showRate && (
              <td className="px-3 py-2 text-right tabular-nums text-navy-900">
                {Number(line.rate).toLocaleString()}
              </td>
            )}
            <td className="px-3 py-2 text-right tabular-nums text-navy-900">
              {Number(line.amount).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-300 font-semibold text-navy-950">
          <td colSpan={showRate ? 3 : 2} className="px-3 py-2 text-right">
            Total
          </td>
          <td className="px-3 py-2 text-right tabular-nums">PKR {total.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
  );
}

function PurchaseOrderPrint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["purchase-order", id],
    queryFn: async () => (await api.get<PurchaseOrder>(`/inventory/purchase-orders/${id}`)).data,
  });
  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  return (
    <PrintShell
      title="Purchase Order"
      refNo={data.po_no}
      date={data.po_date}
      statusLabel={data.status}
      footerLeft="Prepared By"
      footerRight="Approved By"
    >
      <Row label="Vendor" value={data.vendor.name} />
      <Row label="Project" value={data.project?.project_name ?? "General (Company-wide)"} />
      <Row label="Narration" value={data.narration || "—"} />
      <LinesTable lines={data.lines} showRate />
    </PrintShell>
  );
}

function GRNPrint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["grn", id],
    queryFn: async () => (await api.get<GRN>(`/inventory/grn/${id}`)).data,
  });
  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  return (
    <PrintShell
      title="Goods Receipt Note"
      refNo={data.grn_no}
      date={data.grn_date}
      statusLabel={data.voucher_id ? "Received" : "Pending"}
      footerLeft="Received By"
      footerRight="Store Keeper"
    >
      <Row label="Vendor" value={data.vendor.name} />
      <Row label="Project" value={data.project?.project_name ?? "General (Company-wide)"} />
      <Row label="Paid From" value={data.payment_account.name} />
      <Row label="Narration" value={data.narration || "—"} />
      <LinesTable lines={data.lines} showRate />
    </PrintShell>
  );
}

function MaterialIssuePrint({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["material-issue", id],
    queryFn: async () => (await api.get<MaterialIssue>(`/inventory/issues/${id}`)).data,
  });
  if (!data) return <p className="p-10 text-sm text-slate-400">Loading...</p>;
  const isDamaged = data.reason === "Damaged / Wastage";
  return (
    <PrintShell
      title={isDamaged ? "Material Damage / Wastage Note" : "Material Issue Slip"}
      refNo={data.issue_no}
      date={data.issue_date}
      statusLabel={data.voucher_id ? "Issued" : "Pending"}
      footerLeft="Issued By"
      footerRight="Received By"
    >
      <Row label="Project" value={data.project.project_name} />
      <Row label="Reason" value={data.reason} />
      <Row label={isDamaged ? "Details" : "Issued To"} value={data.issued_to || "—"} />
      {isDamaged && (
        <Row
          label="Resolution"
          value={
            data.resolved
              ? `Resolved (${data.resolved_date})${data.restocked ? " — stock replaced" : ""} — ${data.resolution_note || "—"}`
              : "Pending"
          }
        />
      )}
      <Row label="Narration" value={data.narration || "—"} />
      <LinesTable lines={data.lines} showRate={false} />
    </PrintShell>
  );
}

export default function InventoryPrintPage() {
  const { type, id } = useParams();
  if (!id) return <p className="p-10 text-sm text-slate-400">Missing reference.</p>;
  if (type === "po") return <PurchaseOrderPrint id={id} />;
  if (type === "grn") return <GRNPrint id={id} />;
  if (type === "issue") return <MaterialIssuePrint id={id} />;
  return <p className="p-10 text-sm text-slate-400">Unknown document type.</p>;
}
