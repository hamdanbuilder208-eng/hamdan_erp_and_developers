import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Plus, Printer, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import type { Account, Project, Voucher, VoucherType } from "../types";

const voucherTypes: VoucherType[] = ["Receipt", "Payment", "Journal", "Contra"];

const voucherTypeTone: Record<VoucherType, "success" | "danger" | "info" | "neutral"> = {
  Receipt: "success",
  Payment: "danger",
  Journal: "info",
  Contra: "neutral",
};

interface LineForm {
  account_id: string;
  debit: string;
  credit: string;
  narration: string;
}

const emptyLine = (): LineForm => ({ account_id: "", debit: "", credit: "", narration: "" });

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function VouchersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [filterType, setFilterType] = React.useState("");

  const [voucherType, setVoucherType] = React.useState<VoucherType>("Receipt");
  const [voucherDate, setVoucherDate] = React.useState(todayIso());
  const [projectId, setProjectId] = React.useState("");
  const [narration, setNarration] = React.useState("");
  const [lines, setLines] = React.useState<LineForm[]>([emptyLine(), emptyLine()]);
  const [formError, setFormError] = React.useState<string | null>(null);

  const { data: vouchers, isLoading } = useQuery({
    queryKey: ["vouchers", filterType],
    queryFn: async () =>
      (await api.get<Voucher[]>("/vouchers/", { params: { voucher_type: filterType || undefined } })).data,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });

  const postableAccounts = accounts?.filter((a) => !a.is_control) ?? [];

  const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.01;

  const resetForm = () => {
    setVoucherType("Receipt");
    setVoucherDate(todayIso());
    setProjectId("");
    setNarration("");
    setLines([emptyLine(), emptyLine()]);
    setFormError(null);
  };

  const createVoucher = useMutation({
    mutationFn: async () =>
      (
        await api.post<Voucher>("/vouchers/", {
          voucher_type: voucherType,
          voucher_date: voucherDate,
          project_id: projectId ? Number(projectId) : null,
          narration: narration || null,
          lines: lines
            .filter((l) => l.account_id)
            .map((l) => ({
              account_id: Number(l.account_id),
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
              narration: l.narration || null,
            })),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      setFormError(
        Array.isArray(message) ? message.map((m) => m.msg).join(", ") : String(message ?? "Failed to save voucher"),
      );
    },
  });

  const deleteVoucher = useMutation({
    mutationFn: async (id: number) => api.delete(`/vouchers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(message ?? "Failed to delete voucher.");
    },
  });

  const updateLine = (index: number, patch: Partial<LineForm>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Vouchers</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Cash/bank receipts &amp; payments, journal entries — double-entry postings.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Voucher
        </Button>
      </div>

      <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-48">
        <option value="">All Types</option>
        {voucherTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Voucher #</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Narration</th>
              <th className="px-5 py-3 font-medium">Accounts</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && vouchers?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No vouchers yet. Click "New Voucher" to record a transaction.
                </td>
              </tr>
            )}
            {vouchers?.map((v) => (
              <tr key={v.id}>
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{v.voucher_no}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{v.voucher_date}</td>
                <td className="px-5 py-3">
                  <Badge tone={voucherTypeTone[v.voucher_type]}>{v.voucher_type}</Badge>
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{v.narration || "—"}</td>
                <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {v.lines.map((l) => l.account.name).join(" → ")}
                </td>
                <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                  PKR {v.lines.reduce((s, l) => s + Number(l.debit), 0).toLocaleString()}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => window.open(`/vouchers/${v.id}/print`, "_blank")}
                      title="Print / Download PDF"
                      className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete voucher "${v.voucher_no}"? This cannot be undone.`)) {
                          deleteVoucher.mutate(v.id);
                        }
                      }}
                      title="Delete voucher"
                      className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
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

      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="New Voucher"
        description="Every posting must balance — total debit must equal total credit."
        className="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            createVoucher.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="v_type">Voucher Type</Label>
              <Select
                id="v_type"
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value as VoucherType)}
              >
                {voucherTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="v_date">Date</Label>
              <Input
                id="v_date"
                type="date"
                required
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="v_project">Project (optional)</Label>
              <Select id="v_project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">— None —</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="v_narration">Narration</Label>
            <Input
              id="v_narration"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="e.g. Booking advance received"
            />
          </div>

          <div className="space-y-2 border-t border-slate-100 dark:border-navy-800 pt-4">
            <div className="grid grid-cols-[1fr_100px_100px_28px] gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <span>Account</span>
              <span>Debit</span>
              <span>Credit</span>
              <span />
            </div>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_28px] gap-2">
                <Select
                  value={line.account_id}
                  onChange={(e) => updateLine(i, { account_id: e.target.value })}
                >
                  <option value="">Select account</option>
                  {postableAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  value={line.debit}
                  onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })}
                  placeholder="0"
                />
                <Input
                  type="number"
                  value={line.credit}
                  onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })}
                  placeholder="0"
                />
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  disabled={lines.length <= 2}
                  className="flex items-center justify-center rounded-md text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add line
            </Button>
          </div>

          <div
            className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm ${
              isBalanced ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {isBalanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              Debit: PKR {totalDebit.toLocaleString()} &nbsp;·&nbsp; Credit: PKR {totalCredit.toLocaleString()}
            </span>
            <span className="font-medium">{isBalanced ? "Balanced" : "Not balanced"}</span>
          </div>

          {formError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{formError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isBalanced || createVoucher.isPending}>
              Post Voucher
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
