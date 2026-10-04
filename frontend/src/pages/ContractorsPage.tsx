import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSignature, HardHat, Pencil, Plus, Printer, Receipt, Trash2, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import {
  PaymentModeSection,
  emptyPaymentMode,
  paymentModeLabel,
  paymentModePayload,
} from "../components/payments/PaymentDetailsFields";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type {
  Account,
  ContractAgreement,
  ContractAgreementDetail,
  ContractBasis,
  ContractStatus,
  ContractorPaymentPurpose,
  ContractorSummary,
  Project,
} from "../types";

const TRADES = [
  "Complete / Turnkey",
  "Grey Structure",
  "Civil Structure",
  "Finishing",
  "Electrical",
  "Plumbing",
  "Paint",
  "Tiles / Flooring",
  "Woodwork",
  "Steel / Fabrication",
  "Other",
];
const BASES: ContractBasis[] = ["Lump Sum", "Per Sq. Ft.", "Per Sq. Yd.", "Per Floor", "Item Rate / BOQ"];
const STATUSES: ContractStatus[] = ["Active", "Completed", "Cancelled"];
const PURPOSES: ContractorPaymentPurpose[] = ["Bill Payment", "Advance", "Retention Release"];

// What "quantity" means for each basis.
const QTY_UNIT: Record<ContractBasis, string> = {
  "Lump Sum": "",
  "Per Sq. Ft.": "sq ft",
  "Per Sq. Yd.": "sq yd",
  "Per Floor": "floors",
  "Item Rate / BOQ": "units",
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const pkr = (n: number) => `PKR ${Number(n).toLocaleString()}`;
const statusTone = { Active: "success", Completed: "info", Cancelled: "danger" } as const;

const emptyContractorForm = {
  name: "",
  cnic: "",
  ntn: "",
  trade: TRADES[1],
  phone: "",
  bank_name: "",
  account_iban: "",
  is_active: true,
};

const emptyAgreementForm = () => ({
  agreement_date: todayIso(),
  project_id: "",
  contractor_id: "",
  scope_title: "",
  work_type: "",
  floors_scope: "",
  basis: "Per Sq. Ft." as ContractBasis,
  quantity: "",
  rate: "",
  contract_amount: "",
  retention_percent: "5",
  wht_percent: "7.5",
  start_date: "",
  end_date: "",
  status: "Active" as ContractStatus,
  remarks: "",
});

const emptyBillForm = () => ({ bill_date: todayIso(), description: "", work_quantity: "", gross_amount: "" });

const emptyPaymentForm = () => ({
  payment_date: todayIso(),
  purpose: "Bill Payment" as ContractorPaymentPurpose,
  amount: "",
  credit_account_id: "",
  narration: "",
  ...emptyPaymentMode(),
});

// CNIC: digits only, auto-dashed as xxxxx-xxxxxxx-x.
function formatCnic(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-navy-700">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          tone === "danger" ? "text-danger-600" : tone === "success" ? "text-success-700" : "text-navy-950 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function ContractorsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<"agreements" | "contractors">("agreements");
  const [projectFilter, setProjectFilter] = React.useState("");

  const { data: contractors, isLoading: contractorsLoading } = useQuery({
    queryKey: ["contractors"],
    queryFn: async () => (await api.get<ContractorSummary[]>("/contractors/")).data,
  });
  const { data: agreements, isLoading: agreementsLoading } = useQuery({
    queryKey: ["contract-agreements", projectFilter],
    queryFn: async () =>
      (
        await api.get<ContractAgreement[]>("/contractors/agreements", {
          params: projectFilter ? { project_id: Number(projectFilter) } : undefined,
        })
      ).data,
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });
  const cashAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["contractors"] });
    queryClient.invalidateQueries({ queryKey: ["contract-agreements"] });
    queryClient.invalidateQueries({ queryKey: ["contract-agreement"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  // ---- Contractor form ----
  const [contractorModalOpen, setContractorModalOpen] = React.useState(false);
  const [editingContractorId, setEditingContractorId] = React.useState<number | null>(null);
  const [contractorForm, setContractorForm] = React.useState(emptyContractorForm);
  const openContractor = (c?: ContractorSummary) => {
    setEditingContractorId(c?.id ?? null);
    setContractorForm(
      c
        ? {
            name: c.name,
            cnic: c.cnic,
            ntn: c.ntn ?? "",
            trade: c.trade,
            phone: c.phone ?? "",
            bank_name: c.bank_name ?? "",
            account_iban: c.account_iban ?? "",
            is_active: c.is_active,
          }
        : emptyContractorForm,
    );
    setContractorModalOpen(true);
  };
  const saveContractor = useMutation({
    mutationFn: async () =>
      api.request({
        method: editingContractorId ? "put" : "post",
        url: editingContractorId ? `/contractors/${editingContractorId}` : "/contractors/",
        data: {
          ...contractorForm,
          ntn: contractorForm.ntn || null,
          phone: contractorForm.phone || null,
          bank_name: contractorForm.bank_name || null,
          account_iban: contractorForm.account_iban || null,
        },
      }),
    onSuccess: () => {
      refresh();
      setContractorModalOpen(false);
      toast.success(editingContractorId ? "Contractor updated." : "Contractor registered.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to save contractor.")),
  });
  const deleteContractor = useMutation({
    mutationFn: async (id: number) => api.delete(`/contractors/${id}`),
    onSuccess: refresh,
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete contractor.")),
  });

  // ---- Agreement form ----
  const [agreementModalOpen, setAgreementModalOpen] = React.useState(false);
  const [editingAgreementId, setEditingAgreementId] = React.useState<number | null>(null);
  const [agreementForm, setAgreementForm] = React.useState(emptyAgreementForm);
  const isLumpSum = agreementForm.basis === "Lump Sum";
  const computedAmount =
    !isLumpSum && Number(agreementForm.quantity) > 0 && agreementForm.rate !== ""
      ? Math.round(Number(agreementForm.quantity) * Number(agreementForm.rate) * 100) / 100
      : null;

  const openAgreement = (a?: ContractAgreement) => {
    setEditingAgreementId(a?.id ?? null);
    setAgreementForm(
      a
        ? {
            agreement_date: a.agreement_date,
            project_id: String(a.project_id),
            contractor_id: String(a.contractor_id),
            scope_title: a.scope_title,
            work_type: a.work_type,
            floors_scope: a.floors_scope ?? "",
            basis: a.basis,
            quantity: a.quantity != null ? String(Number(a.quantity)) : "",
            rate: a.rate != null ? String(Number(a.rate)) : "",
            contract_amount: String(Number(a.contract_amount)),
            retention_percent: String(Number(a.retention_percent)),
            wht_percent: String(Number(a.wht_percent)),
            start_date: a.start_date ?? "",
            end_date: a.end_date ?? "",
            status: a.status,
            remarks: a.remarks ?? "",
          }
        : { ...emptyAgreementForm(), project_id: projectFilter },
    );
    setAgreementModalOpen(true);
  };
  const saveAgreement = useMutation({
    mutationFn: async () =>
      api.request({
        method: editingAgreementId ? "put" : "post",
        url: editingAgreementId ? `/contractors/agreements/${editingAgreementId}` : "/contractors/agreements",
        data: {
          agreement_date: agreementForm.agreement_date,
          project_id: Number(agreementForm.project_id),
          contractor_id: Number(agreementForm.contractor_id),
          scope_title: agreementForm.scope_title,
          work_type: agreementForm.work_type,
          floors_scope: agreementForm.floors_scope || null,
          basis: agreementForm.basis,
          quantity: !isLumpSum && agreementForm.quantity ? Number(agreementForm.quantity) : null,
          rate: !isLumpSum && agreementForm.rate !== "" ? Number(agreementForm.rate) : null,
          contract_amount: isLumpSum ? Number(agreementForm.contract_amount) : computedAmount,
          retention_percent: Number(agreementForm.retention_percent) || 0,
          wht_percent: Number(agreementForm.wht_percent) || 0,
          start_date: agreementForm.start_date || null,
          end_date: agreementForm.end_date || null,
          status: agreementForm.status,
          remarks: agreementForm.remarks || null,
        },
      }),
    onSuccess: () => {
      refresh();
      setAgreementModalOpen(false);
      toast.success(editingAgreementId ? "Agreement updated." : "Contract agreement saved.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to save agreement.")),
  });
  const deleteAgreement = useMutation({
    mutationFn: async (id: number) => api.delete(`/contractors/agreements/${id}`),
    onSuccess: () => {
      refresh();
      setDetailId(null);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete agreement.")),
  });

  // ---- Agreement detail: bills & payments ----
  const [detailId, setDetailId] = React.useState<number | null>(null);
  const { data: detail } = useQuery({
    queryKey: ["contract-agreement", detailId],
    queryFn: async () => (await api.get<ContractAgreementDetail>(`/contractors/agreements/${detailId}`)).data,
    enabled: detailId !== null,
  });

  const [billModalOpen, setBillModalOpen] = React.useState(false);
  const [billForm, setBillForm] = React.useState(emptyBillForm);
  const billGross = Number(billForm.gross_amount) || 0;
  const billRetention = detail ? (billGross * Number(detail.retention_percent)) / 100 : 0;
  const billWht = detail ? (billGross * Number(detail.wht_percent)) / 100 : 0;
  const addBill = useMutation({
    mutationFn: async () =>
      api.post(`/contractors/agreements/${detailId}/bills`, {
        bill_date: billForm.bill_date,
        description: billForm.description || null,
        work_quantity: billForm.work_quantity ? Number(billForm.work_quantity) : null,
        gross_amount: billGross,
      }),
    onSuccess: () => {
      refresh();
      setBillModalOpen(false);
      toast.success("Bill recorded.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to record bill.")),
  });
  const deleteBill = useMutation({
    mutationFn: async (id: number) => api.delete(`/contractors/bills/${id}`),
    onSuccess: refresh,
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete bill.")),
  });

  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [paymentForm, setPaymentForm] = React.useState(emptyPaymentForm);
  const suggestedAmount = (purpose: ContractorPaymentPurpose) => {
    if (!detail) return "";
    const v = purpose === "Retention Release" ? detail.retention_held : purpose === "Bill Payment" ? detail.due_now : 0;
    return v > 0 ? String(v) : "";
  };
  const openPayment = () => {
    setPaymentForm({ ...emptyPaymentForm(), amount: suggestedAmount("Bill Payment") });
    setPaymentModalOpen(true);
  };
  const addPayment = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ id: number }>(`/contractors/agreements/${detailId}/payments`, {
          payment_date: paymentForm.payment_date,
          purpose: paymentForm.purpose,
          amount: Number(paymentForm.amount),
          credit_account_id: Number(paymentForm.credit_account_id),
          narration: paymentForm.narration || null,
          ...paymentModePayload(paymentForm),
        })
      ).data,
    onSuccess: (payment) => {
      refresh();
      setPaymentModalOpen(false);
      toast.success("Payment recorded.");
      window.open(`/contractors/payments/${payment.id}/print`, "_blank");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to record payment.")),
  });
  const deletePayment = useMutation({
    mutationFn: async (id: number) => api.delete(`/contractors/payments/${id}`),
    onSuccess: refresh,
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete payment.")),
  });

  const activeContractors = contractors?.filter((c) => c.is_active) ?? [];
  const totals = (agreements ?? [])
    .filter((a) => a.status !== "Cancelled")
    .reduce(
      (s, a) => ({
        contract: s.contract + Number(a.contract_amount),
        billed: s.billed + a.billed_gross,
        paid: s.paid + a.paid_total,
        due: s.due + Math.max(a.due_now, 0),
        retention: s.retention + a.retention_held,
      }),
      { contract: 0, billed: 0, paid: 0, due: 0, retention: 0 },
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Contractors</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Work given out on each project — turnkey, structure, electrical, plumbing — and every contractor's
            running account: billed, paid, retention and balance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openContractor()}>
            <HardHat className="h-4 w-4" />
            New Contractor
          </Button>
          <Button onClick={() => openAgreement()} disabled={!activeContractors.length}>
            <FileSignature className="h-4 w-4" />
            New Agreement
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-navy-700">
        {(["agreements", "contractors"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 hover:text-navy-800 dark:text-slate-400"
            }`}
          >
            {t === "agreements" ? "Contract Agreements" : "Contractors"}
          </button>
        ))}
      </div>

      {tab === "agreements" && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-64">
              <Label htmlFor="ag_project_filter">Project</Label>
              <Select id="ag_project_filter" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                <option value="">All projects</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Contracts" value={pkr(totals.contract)} />
            <Stat label="Work Billed" value={pkr(totals.billed)} />
            <Stat label="Paid" value={pkr(totals.paid)} tone="success" />
            <Stat label="Due to Contractors" value={pkr(totals.due)} tone="danger" />
            <Stat label="Retention Held" value={pkr(totals.retention)} />
          </div>
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-navy-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Agreement</th>
                  <th className="px-4 py-3 font-medium">Contractor</th>
                  <th className="px-4 py-3 font-medium">Work</th>
                  <th className="px-4 py-3 font-medium">Basis</th>
                  <th className="px-4 py-3 text-right font-medium">Contract</th>
                  <th className="px-4 py-3 text-right font-medium">Billed</th>
                  <th className="px-4 py-3 text-right font-medium">Paid</th>
                  <th className="px-4 py-3 text-right font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {agreementsLoading && <TableRowsSkeleton rows={4} cols={9} />}
                {!agreementsLoading && agreements?.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No contract agreements yet. Register a contractor, then click "New Agreement".
                    </td>
                  </tr>
                )}
                {agreements?.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => setDetailId(a.id)}
                    className="cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-slate-500">{a.agreement_no}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{a.project_name}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-navy-900 dark:text-slate-100">{a.contractor.name}</td>
                    <td className="px-4 py-3">
                      <p className="text-navy-900 dark:text-slate-100">{a.scope_title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {a.work_type}
                        {a.floors_scope ? ` · ${a.floors_scope}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {a.basis}
                      {a.quantity != null &&
                        ` · ${Number(a.quantity).toLocaleString()} ${QTY_UNIT[a.basis]} @ ${Number(a.rate ?? 0).toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{Number(a.contract_amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{a.billed_gross.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-success-700">{a.paid_total.toLocaleString()}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold tabular-nums ${
                        a.due_now > 0 ? "text-danger-600" : "text-slate-500"
                      }`}
                    >
                      {a.due_now < 0 ? `Adv. ${Math.abs(a.due_now).toLocaleString()}` : a.due_now.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[a.status]}>{a.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {tab === "contractors" && (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-navy-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Contractor</th>
                <th className="px-4 py-3 font-medium">Trade</th>
                <th className="px-4 py-3 font-medium">Contact / Bank</th>
                <th className="px-4 py-3 text-right font-medium">Agreements</th>
                <th className="px-4 py-3 text-right font-medium">Contracts</th>
                <th className="px-4 py-3 text-right font-medium">Paid</th>
                <th className="px-4 py-3 text-right font-medium">Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {contractorsLoading && <TableRowsSkeleton rows={4} cols={9} />}
              {!contractorsLoading && contractors?.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No contractors yet. Click "New Contractor" to register one.
                  </td>
                </tr>
              )}
              {contractors?.map((c) => (
                <tr key={c.id} className={c.is_active ? "" : "opacity-60"}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.contractor_code}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-navy-900 dark:text-slate-100">{c.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      CNIC {c.cnic}
                      {c.ntn ? ` · NTN ${c.ntn}` : ""}
                      {!c.is_active && " · Inactive"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.trade}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    <p>{c.phone || "—"}</p>
                    {(c.bank_name || c.account_iban) && (
                      <p>{[c.bank_name, c.account_iban].filter(Boolean).join(" · ")}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.agreement_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.total_contract.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success-700">{c.total_paid.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-danger-600">
                    {Math.max(c.total_due, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openContractor(c)}
                        title="Edit contractor"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (await confirm(`Delete contractor "${c.name}"?`, { danger: true, confirmLabel: "Delete" }))
                            deleteContractor.mutate(c.id);
                        }}
                        title="Delete contractor"
                        className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ---- New / Edit Contractor ---- */}
      <Modal
        open={contractorModalOpen}
        onClose={() => setContractorModalOpen(false)}
        title={editingContractorId ? "Edit Contractor" : "New Contractor Registration"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveContractor.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="ct_name">Contractor / Firm Name *</Label>
            <Input
              id="ct_name"
              required
              value={contractorForm.name}
              onChange={(e) => setContractorForm({ ...contractorForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ct_cnic">CNIC Number *</Label>
              <Input
                id="ct_cnic"
                required
                inputMode="numeric"
                placeholder="42101-XXXXXXX-X"
                value={contractorForm.cnic}
                onChange={(e) => setContractorForm({ ...contractorForm, cnic: formatCnic(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="ct_ntn">Tax NTN #</Label>
              <Input
                id="ct_ntn"
                value={contractorForm.ntn}
                onChange={(e) => setContractorForm({ ...contractorForm, ntn: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ct_trade">Specialization Trade</Label>
              <Select
                id="ct_trade"
                value={contractorForm.trade}
                onChange={(e) => setContractorForm({ ...contractorForm, trade: e.target.value })}
              >
                {TRADES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ct_phone">Phone Number</Label>
              <Input
                id="ct_phone"
                inputMode="tel"
                value={contractorForm.phone}
                onChange={(e) =>
                  setContractorForm({ ...contractorForm, phone: e.target.value.replace(/[^0-9+\-() ]/g, "") })
                }
              />
            </div>
            <div>
              <Label htmlFor="ct_bank">Bank Name</Label>
              <Input
                id="ct_bank"
                value={contractorForm.bank_name}
                onChange={(e) => setContractorForm({ ...contractorForm, bank_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ct_iban">Account IBAN</Label>
              <Input
                id="ct_iban"
                value={contractorForm.account_iban}
                onChange={(e) => setContractorForm({ ...contractorForm, account_iban: e.target.value })}
              />
            </div>
          </div>
          {editingContractorId && (
            <label className="inline-flex items-center gap-2 text-sm text-navy-900 dark:text-slate-100">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={contractorForm.is_active}
                onChange={(e) => setContractorForm({ ...contractorForm, is_active: e.target.checked })}
              />
              Active (shown when making new agreements)
            </label>
          )}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-navy-800">
            <Button type="button" variant="secondary" onClick={() => setContractorModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveContractor.isPending}>
              Save Contractor
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- New / Edit Agreement ---- */}
      <Modal
        open={agreementModalOpen}
        onClose={() => setAgreementModalOpen(false)}
        title={editingAgreementId ? "Edit Contract Agreement" : "Contract Agreement Form"}
        description="Which project, which contractor, what work, and how it's priced."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveAgreement.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ag_project">Target Project *</Label>
              <Select
                id="ag_project"
                required
                value={agreementForm.project_id}
                onChange={(e) => setAgreementForm({ ...agreementForm, project_id: e.target.value })}
              >
                <option value="">Select project</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ag_date">Agreement Date *</Label>
              <Input
                id="ag_date"
                type="date"
                required
                value={agreementForm.agreement_date}
                onChange={(e) => setAgreementForm({ ...agreementForm, agreement_date: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ag_contractor">Select Contractor *</Label>
            <Select
              id="ag_contractor"
              required
              value={agreementForm.contractor_id}
              onChange={(e) => {
                const c = contractors?.find((x) => x.id === Number(e.target.value));
                setAgreementForm({
                  ...agreementForm,
                  contractor_id: e.target.value,
                  work_type: agreementForm.work_type || c?.trade || "",
                });
              }}
            >
              <option value="">Select contractor</option>
              {(contractors ?? [])
                .filter((c) => c.is_active || String(c.id) === agreementForm.contractor_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.trade})
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ag_scope">Work Scope Title *</Label>
            <Input
              id="ag_scope"
              required
              placeholder="e.g. Complete Structure Work Block B"
              value={agreementForm.scope_title}
              onChange={(e) => setAgreementForm({ ...agreementForm, scope_title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ag_work_type">Type of Work *</Label>
              <Input
                id="ag_work_type"
                required
                list="ag_trades"
                value={agreementForm.work_type}
                onChange={(e) => setAgreementForm({ ...agreementForm, work_type: e.target.value })}
              />
              <datalist id="ag_trades">
                {TRADES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div>
              <Label htmlFor="ag_floors">Floors / Area Covered</Label>
              <Input
                id="ag_floors"
                placeholder="e.g. Ground to 2nd Floor, Whole building"
                value={agreementForm.floors_scope}
                onChange={(e) => setAgreementForm({ ...agreementForm, floors_scope: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ag_basis">Contract Type *</Label>
              <Select
                id="ag_basis"
                value={agreementForm.basis}
                onChange={(e) => setAgreementForm({ ...agreementForm, basis: e.target.value as ContractBasis })}
              >
                {BASES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </div>
            {isLumpSum ? (
              <div className="col-span-2">
                <Label htmlFor="ag_amount">Contract Amount (PKR) *</Label>
                <Input
                  id="ag_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={agreementForm.contract_amount}
                  onChange={(e) => setAgreementForm({ ...agreementForm, contract_amount: e.target.value })}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="ag_qty">Quantity ({QTY_UNIT[agreementForm.basis]}) *</Label>
                  <Input
                    id="ag_qty"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={agreementForm.quantity}
                    onChange={(e) => setAgreementForm({ ...agreementForm, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ag_rate">Rate (PKR / {QTY_UNIT[agreementForm.basis]}) *</Label>
                  <Input
                    id="ag_rate"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={agreementForm.rate}
                    onChange={(e) => setAgreementForm({ ...agreementForm, rate: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          {computedAmount !== null && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
              Contract amount: <span className="font-semibold">{pkr(computedAmount)}</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ag_retention">Retention (%)</Label>
              <Input
                id="ag_retention"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={agreementForm.retention_percent}
                onChange={(e) => setAgreementForm({ ...agreementForm, retention_percent: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ag_wht">Tax WHT (%)</Label>
              <Input
                id="ag_wht"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={agreementForm.wht_percent}
                onChange={(e) => setAgreementForm({ ...agreementForm, wht_percent: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ag_start">Start Date</Label>
              <Input
                id="ag_start"
                type="date"
                value={agreementForm.start_date}
                onChange={(e) => setAgreementForm({ ...agreementForm, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ag_end">Expected Completion</Label>
              <Input
                id="ag_end"
                type="date"
                value={agreementForm.end_date}
                onChange={(e) => setAgreementForm({ ...agreementForm, end_date: e.target.value })}
              />
            </div>
          </div>
          {editingAgreementId && (
            <div className="w-48">
              <Label htmlFor="ag_status">Status</Label>
              <Select
                id="ag_status"
                value={agreementForm.status}
                onChange={(e) => setAgreementForm({ ...agreementForm, status: e.target.value as ContractStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="ag_remarks">Remarks</Label>
            <Input
              id="ag_remarks"
              value={agreementForm.remarks}
              onChange={(e) => setAgreementForm({ ...agreementForm, remarks: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-navy-800">
            <Button type="button" variant="secondary" onClick={() => setAgreementModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveAgreement.isPending}>
              Save Contract Agreement
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Agreement detail ---- */}
      <Modal
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.agreement_no} — ${detail.contractor.name}` : "Agreement"}
        description={
          detail
            ? `${detail.project_name} · ${detail.scope_title} · ${detail.work_type}${
                detail.floors_scope ? ` · ${detail.floors_scope}` : ""
              }`
            : undefined
        }
        className="max-w-4xl"
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Badge tone={statusTone[detail.status]}>{detail.status}</Badge>
                <span>
                  {detail.basis}
                  {detail.quantity != null &&
                    ` · ${Number(detail.quantity).toLocaleString()} ${QTY_UNIT[detail.basis]} @ PKR ${Number(
                      detail.rate ?? 0,
                    ).toLocaleString()}`}
                  {` · Retention ${Number(detail.retention_percent)}% · WHT ${Number(detail.wht_percent)}%`}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDetailId(null);
                    openAgreement(detail);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (
                      await confirm(`Delete agreement ${detail.agreement_no} and its bills?`, {
                        danger: true,
                        confirmLabel: "Delete",
                      })
                    )
                      deleteAgreement.mutate(detail.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Contract Amount" value={pkr(detail.contract_amount)} />
              <Stat label="Work Billed" value={pkr(detail.billed_gross)} />
              <Stat label="Remaining Work" value={pkr(detail.remaining_work)} />
              <Stat label="Paid" value={pkr(detail.paid_total)} tone="success" />
              <Stat label="Retention Held" value={pkr(detail.retention_held)} />
              <Stat label="WHT Deducted" value={pkr(detail.wht_total)} />
              <Stat
                label={detail.due_now < 0 ? "Advance (not yet billed)" : "Balance Due Now"}
                value={pkr(Math.abs(detail.due_now))}
                tone={detail.due_now > 0 ? "danger" : undefined}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bills (work done)</p>
                {detail.status !== "Cancelled" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setBillForm(emptyBillForm());
                      setBillModalOpen(true);
                    }}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    Add Bill
                  </Button>
                )}
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-slate-200 dark:border-navy-700">
                    <th className="py-2 font-medium">Bill</th>
                    <th className="py-2 font-medium">Work</th>
                    <th className="py-2 text-right font-medium">Gross</th>
                    <th className="py-2 text-right font-medium">Retention</th>
                    <th className="py-2 text-right font-medium">WHT</th>
                    <th className="py-2 text-right font-medium">Net</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {detail.bills.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-xs text-slate-400">
                        No bills yet.
                      </td>
                    </tr>
                  )}
                  {detail.bills.map((b) => (
                    <tr key={b.id} className="border-b border-slate-100 dark:border-navy-800">
                      <td className="py-2">
                        <p className="font-mono text-xs text-slate-500">{b.bill_no}</p>
                        <p className="text-xs text-slate-400">{b.bill_date}</p>
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">
                        {b.description || "—"}
                        {b.work_quantity != null &&
                          ` (${Number(b.work_quantity).toLocaleString()} ${QTY_UNIT[detail.basis]})`}
                      </td>
                      <td className="py-2 text-right tabular-nums">{Number(b.gross_amount).toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums">{Number(b.retention_amount).toLocaleString()}</td>
                      <td className="py-2 text-right tabular-nums">{Number(b.wht_amount).toLocaleString()}</td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {Number(b.net_amount).toLocaleString()}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={async () => {
                            if (await confirm(`Delete bill ${b.bill_no}?`, { danger: true, confirmLabel: "Delete" }))
                              deleteBill.mutate(b.id);
                          }}
                          className="rounded-md p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payments</p>
                {detail.status !== "Cancelled" && (
                  <Button size="sm" onClick={openPayment}>
                    <Wallet className="h-3.5 w-3.5" />
                    Record Payment
                  </Button>
                )}
              </div>
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-slate-200 dark:border-navy-700">
                    <th className="py-2 font-medium">Payment</th>
                    <th className="py-2 font-medium">For</th>
                    <th className="py-2 font-medium">Paid From</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {detail.payments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-xs text-slate-400">
                        No payments yet.
                      </td>
                    </tr>
                  )}
                  {detail.payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-navy-800">
                      <td className="py-2">
                        <p className="font-mono text-xs text-slate-500">{p.payment_no}</p>
                        <p className="text-xs text-slate-400">{p.payment_date}</p>
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">{p.purpose}</td>
                      <td className="py-2 text-slate-600 dark:text-slate-300">
                        {p.credit_account.name}
                        {paymentModeLabel(p) && <span className="block text-xs text-slate-400">{paymentModeLabel(p)}</span>}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">{Number(p.amount).toLocaleString()}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => window.open(`/contractors/payments/${p.id}/print`, "_blank")}
                            title="Print payment voucher"
                            className="rounded-md p-1 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                await confirm(`Delete payment ${p.payment_no}? Its voucher is removed too.`, {
                                  danger: true,
                                  confirmLabel: "Delete",
                                })
                              )
                                deletePayment.mutate(p.id);
                            }}
                            className="rounded-md p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- Add Bill ---- */}
      <Modal
        open={billModalOpen}
        onClose={() => setBillModalOpen(false)}
        title="Add Bill (Work Done)"
        description={detail ? `${detail.agreement_no} — ${pkr(detail.remaining_work)} of the contract left to bill` : undefined}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addBill.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bl_date">Bill Date *</Label>
              <Input
                id="bl_date"
                type="date"
                required
                value={billForm.bill_date}
                onChange={(e) => setBillForm({ ...billForm, bill_date: e.target.value })}
              />
            </div>
            {detail && detail.basis !== "Lump Sum" && (
              <div>
                <Label htmlFor="bl_qty">Work Done ({QTY_UNIT[detail.basis]})</Label>
                <Input
                  id="bl_qty"
                  type="number"
                  min="0"
                  step="0.01"
                  value={billForm.work_quantity}
                  onChange={(e) => {
                    const qty = e.target.value;
                    const gross = Number(qty) > 0 && detail.rate ? String(Math.round(Number(qty) * Number(detail.rate) * 100) / 100) : billForm.gross_amount;
                    setBillForm({ ...billForm, work_quantity: qty, gross_amount: gross });
                  }}
                />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="bl_desc">Description</Label>
            <Input
              id="bl_desc"
              placeholder="e.g. Running Bill #1 — Ground floor slab"
              value={billForm.description}
              onChange={(e) => setBillForm({ ...billForm, description: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="bl_gross">Gross Amount (PKR) *</Label>
            <Input
              id="bl_gross"
              type="number"
              min="0"
              step="0.01"
              required
              value={billForm.gross_amount}
              onChange={(e) => setBillForm({ ...billForm, gross_amount: e.target.value })}
            />
          </div>
          {billGross > 0 && detail && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat label={`Retention (${Number(detail.retention_percent)}%)`} value={pkr(Math.round(billRetention * 100) / 100)} />
              <Stat label={`WHT (${Number(detail.wht_percent)}%)`} value={pkr(Math.round(billWht * 100) / 100)} />
              <Stat label="Net Payable" value={pkr(Math.round((billGross - billRetention - billWht) * 100) / 100)} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setBillModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addBill.isPending}>
              Save Bill
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Record Payment ---- */}
      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Contractor Payment"
        description={
          detail
            ? `Due now ${pkr(Math.max(detail.due_now, 0))} · Retention held ${pkr(detail.retention_held)}`
            : undefined
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addPayment.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cp_date">Payment Date *</Label>
              <Input
                id="cp_date"
                type="date"
                required
                value={paymentForm.payment_date}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cp_purpose">Payment For *</Label>
              <Select
                id="cp_purpose"
                value={paymentForm.purpose}
                onChange={(e) => {
                  const purpose = e.target.value as ContractorPaymentPurpose;
                  setPaymentForm({ ...paymentForm, purpose, amount: suggestedAmount(purpose) });
                }}
              >
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="cp_amount">Amount (PKR) *</Label>
              <Input
                id="cp_amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cp_account">Paid From *</Label>
              <Select
                id="cp_account"
                required
                value={paymentForm.credit_account_id}
                onChange={(e) => setPaymentForm({ ...paymentForm, credit_account_id: e.target.value })}
              >
                <option value="">Select account</option>
                {cashAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <PaymentModeSection
            idPrefix="cp"
            value={paymentForm}
            onChange={(patch) => setPaymentForm({ ...paymentForm, ...patch })}
          />
          <div>
            <Label htmlFor="cp_narration">Narration</Label>
            <Input
              id="cp_narration"
              value={paymentForm.narration}
              onChange={(e) => setPaymentForm({ ...paymentForm, narration: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addPayment.isPending}>
              <Plus className="h-4 w-4" />
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
