import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Plus, Trash2, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import type { Account, Partner, PartnerSummary } from "../types";

const emptyForm = {
  name: "",
  contact_info: "",
  linked_account_id: "",
};

const emptyDrawingForm = {
  amount: "",
  credit_account_id: "",
  narration: "",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function PartnersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [selectedPartnerId, setSelectedPartnerId] = React.useState<number | null>(null);
  const [drawingProjectId, setDrawingProjectId] = React.useState<number | null>(null);
  const [drawingForm, setDrawingForm] = React.useState(emptyDrawingForm);
  const [drawingError, setDrawingError] = React.useState<string | null>(null);

  const { data: partners, isLoading } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => (await api.get<Partner[]>("/partners/")).data,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const { data: summary } = useQuery({
    queryKey: ["partner-summary", selectedPartnerId],
    queryFn: async () => (await api.get<PartnerSummary>(`/partners/${selectedPartnerId}/summary`)).data,
    enabled: !!selectedPartnerId,
  });

  const postableAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];

  const createPartner = useMutation({
    mutationFn: async () =>
      (
        await api.post<Partner>("/partners/", {
          name: form.name,
          contact_info: form.contact_info || null,
          linked_account_id: form.linked_account_id ? Number(form.linked_account_id) : null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      setModalOpen(false);
      setForm(emptyForm);
    },
  });

  const deletePartner = useMutation({
    mutationFn: async (id: number) => api.delete(`/partners/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      if (selectedPartnerId === id) setSelectedPartnerId(null);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(message ?? "Failed to delete partner.");
    },
  });

  const createDrawing = useMutation({
    mutationFn: async () =>
      (
        await api.post("/partner-drawings/", {
          drawing_date: todayIso(),
          partner_id: selectedPartnerId,
          project_id: drawingProjectId,
          credit_account_id: Number(drawingForm.credit_account_id),
          amount: Number(drawingForm.amount),
          narration: drawingForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-summary", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setDrawingProjectId(null);
      setDrawingForm(emptyDrawingForm);
      setDrawingError(null);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setDrawingError(message ?? "Failed to record drawing");
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Investor / Partner Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Business partners who invest in projects and share in the profit.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Partner
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</p>}
            {!isLoading && partners?.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                No partners yet. Click "New Partner" to add an investor.
              </p>
            )}
            {partners?.map((p) => (
              <div
                key={p.id}
                className={`flex w-full items-center justify-between px-5 py-3 text-sm transition-colors ${
                  selectedPartnerId === p.id ? "bg-brand-50" : "hover:bg-slate-50 dark:hover:bg-navy-800/60"
                }`}
              >
                <button
                  onClick={() => setSelectedPartnerId(p.id)}
                  className="flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5 font-medium text-navy-900 dark:text-slate-100">
                    <Landmark className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    {p.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">{p.partner_code}</span>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete partner "${p.name}"?`)) {
                      deletePartner.mutate(p.id);
                    }
                  }}
                  title="Delete partner"
                  className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2">
          {!summary ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">
                Select a partner to view their profit-share ledger.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Share of Profit</p>
                    <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">
                      PKR {summary.total_share_amount.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Drawn</p>
                    <p className="mt-1 text-lg font-semibold text-success-700">
                      PKR {summary.total_drawn.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Balance</p>
                    <p className="mt-1 text-lg font-semibold text-warning-700">
                      PKR {summary.total_balance.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Project</th>
                      <th className="px-4 py-3 font-medium">Share %</th>
                      <th className="px-4 py-3 text-right font-medium">Net Profit</th>
                      <th className="px-4 py-3 text-right font-medium">Their Share</th>
                      <th className="px-4 py-3 text-right font-medium">Drawn</th>
                      <th className="px-4 py-3 text-right font-medium">Balance</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {summary.projects.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                          No project shares configured for this partner yet. Add one from the
                          project's "Partners" tab.
                        </td>
                      </tr>
                    )}
                    {summary.projects.map((row) => (
                      <tr key={row.project_id}>
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-1.5 font-medium text-navy-900 dark:text-slate-100">
                            <TrendingUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            {row.project_name}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.share_percent}%</td>
                        <td className="px-4 py-3 text-right tabular-nums text-navy-900 dark:text-slate-100">
                          {row.project_net_profit.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-navy-900 dark:text-slate-100">
                          {row.partner_share_amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-success-700">
                          {row.drawn_amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-warning-700">
                          {row.balance.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.balance > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setDrawingProjectId(row.project_id);
                                setDrawingForm({ ...emptyDrawingForm, amount: String(row.balance) });
                              }}
                            >
                              Withdraw
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Partner"
        description="Register an investor / business partner."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPartner.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="p_name">Partner Name</Label>
            <Input
              id="p_name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="p_contact">Contact Info</Label>
            <Input
              id="p_contact"
              value={form.contact_info}
              onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="p_account">Linked Account (optional)</Label>
            <Select
              id="p_account"
              value={form.linked_account_id}
              onChange={(e) => setForm({ ...form, linked_account_id: e.target.value })}
            >
              <option value="">— None —</option>
              {accounts
                ?.filter((a) => !a.is_control)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPartner.isPending}>
              Create Partner
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={drawingProjectId !== null}
        onClose={() => {
          setDrawingProjectId(null);
          setDrawingError(null);
        }}
        title="Withdraw Profit Share"
        description="Record a drawing against this partner's profit share for the project."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setDrawingError(null);
            createDrawing.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="d_amount">Amount</Label>
            <Input
              id="d_amount"
              type="number"
              required
              value={drawingForm.amount}
              onChange={(e) => setDrawingForm({ ...drawingForm, amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="d_account">Paid From</Label>
            <Select
              id="d_account"
              required
              value={drawingForm.credit_account_id}
              onChange={(e) => setDrawingForm({ ...drawingForm, credit_account_id: e.target.value })}
            >
              <option value="">Select account</option>
              {postableAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="d_narration">Narration</Label>
            <Input
              id="d_narration"
              value={drawingForm.narration}
              onChange={(e) => setDrawingForm({ ...drawingForm, narration: e.target.value })}
            />
          </div>
          {drawingError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{drawingError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDrawingProjectId(null);
                setDrawingError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createDrawing.isPending}>
              Record Withdrawal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
