import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, PiggyBank, Plus, Printer, Receipt, Trash2, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type { Account, Partner, PartnerContribution, PartnerExpense, PartnerSummary } from "../types";

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

const CONTRIBUTION_PURPOSES = [
  "Initial Investment",
  "Start of Work",
  "Construction Top-up",
  "Other",
];

const emptyContributionForm = {
  project_id: "",
  contribution_date: "",
  amount: "",
  purpose: CONTRIBUTION_PURPOSES[0],
  debit_account_id: "",
  narration: "",
};

const emptyExpenseForm = {
  project_id: "",
  expense_date: "",
  amount: "",
  expense_account_id: "",
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
  const [contributionModalOpen, setContributionModalOpen] = React.useState(false);
  const [contributionForm, setContributionForm] = React.useState(emptyContributionForm);
  const [contributionError, setContributionError] = React.useState<string | null>(null);
  const [expenseModalOpen, setExpenseModalOpen] = React.useState(false);
  const [expenseForm, setExpenseForm] = React.useState(emptyExpenseForm);
  const [expenseError, setExpenseError] = React.useState<string | null>(null);

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

  const { data: contributions } = useQuery({
    queryKey: ["partner-contributions", selectedPartnerId],
    queryFn: async () =>
      (
        await api.get<PartnerContribution[]>("/partner-contributions/", {
          params: { partner_id: selectedPartnerId },
        })
      ).data,
    enabled: !!selectedPartnerId,
  });

  const { data: partnerExpenses } = useQuery({
    queryKey: ["partner-expenses", selectedPartnerId],
    queryFn: async () =>
      (
        await api.get<PartnerExpense[]>("/partner-expenses/", {
          params: { partner_id: selectedPartnerId },
        })
      ).data,
    enabled: !!selectedPartnerId,
  });

  const postableAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];
  const expenseAccounts = accounts?.filter((a) => a.nature === "Expense" && !a.is_control) ?? [];

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
      toast.error(apiErrorMessage(err, "Failed to delete partner."));
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

  const createContribution = useMutation({
    mutationFn: async () =>
      (
        await api.post("/partner-contributions/", {
          contribution_date: contributionForm.contribution_date || todayIso(),
          partner_id: selectedPartnerId,
          project_id: Number(contributionForm.project_id),
          debit_account_id: Number(contributionForm.debit_account_id),
          amount: Number(contributionForm.amount),
          purpose: contributionForm.purpose || null,
          narration: contributionForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-summary", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["partner-contributions", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setContributionModalOpen(false);
      setContributionForm(emptyContributionForm);
      setContributionError(null);
    },
    onError: (err: unknown) => {
      setContributionError(apiErrorMessage(err, "Failed to record contribution."));
    },
  });

  const deleteContribution = useMutation({
    mutationFn: async (id: number) => api.delete(`/partner-contributions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-summary", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["partner-contributions", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete contribution."));
    },
  });

  const createExpense = useMutation({
    mutationFn: async () =>
      (
        await api.post("/partner-expenses/", {
          expense_date: expenseForm.expense_date || todayIso(),
          partner_id: selectedPartnerId,
          project_id: Number(expenseForm.project_id),
          expense_account_id: Number(expenseForm.expense_account_id),
          amount: Number(expenseForm.amount),
          narration: expenseForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-summary", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setExpenseModalOpen(false);
      setExpenseForm(emptyExpenseForm);
      setExpenseError(null);
    },
    onError: (err: unknown) => {
      setExpenseError(apiErrorMessage(err, "Failed to record expense."));
    },
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: number) => api.delete(`/partner-expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["partner-summary", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["partner-expenses", selectedPartnerId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete expense."));
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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => window.open(`/partners/${selectedPartnerId}/statement/print`, "_blank")}
            disabled={!selectedPartnerId}
          >
            <Printer className="h-4 w-4" />
            Partner Statement
          </Button>
          <Button
            variant="secondary"
            onClick={() => setExpenseModalOpen(true)}
            disabled={!selectedPartnerId}
          >
            <Receipt className="h-4 w-4" />
            Log Expense
          </Button>
          <Button
            variant="secondary"
            onClick={() => setContributionModalOpen(true)}
            disabled={!selectedPartnerId}
          >
            <PiggyBank className="h-4 w-4" />
            Log Contribution
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Partner
          </Button>
        </div>
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
                  onClick={async () => {
                    const ok = await confirm(`Delete partner "${p.name}"?`, {
                      danger: true,
                      confirmLabel: "Delete",
                    });
                    if (ok) deletePartner.mutate(p.id);
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
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Card>
                  <CardContent>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Contributed</p>
                    <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">
                      PKR {summary.total_contributed.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Paid on Behalf</p>
                    <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">
                      PKR {summary.total_partner_expense.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
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
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border-brand-200 bg-brand-50/50 dark:border-brand-900/40 dark:bg-brand-900/10">
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-brand-700 dark:text-brand-300">
                        Current Account Balance
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Contributed − Drawn + Profit Share + Paid on Behalf
                      </p>
                    </div>
                    <p className="text-xl font-bold text-brand-700 dark:text-brand-300">
                      PKR {summary.total_current_account_balance.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Available to Distribute Now
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Revenue collected so far, minus what's still reserved to finish
                        construction.
                      </p>
                    </div>
                    <p className="text-xl font-semibold text-success-700">
                      PKR {summary.total_distributable_share.toLocaleString()}
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
                      <th className="px-4 py-3 text-right font-medium">Distributable Now</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {summary.projects.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                          No project shares configured for this partner yet. Add one from the
                          project's "Partners" tab.
                        </td>
                      </tr>
                    )}
                    {summary.projects.map((row) => (
                      <tr key={row.project_id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                        <td className="px-4 py-3">
                          <p className="flex items-center gap-1.5 font-medium text-navy-900 dark:text-slate-100">
                            <TrendingUp className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            {row.project_name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                            Pledged {row.investment_amount.toLocaleString()} · Contributed{" "}
                            {row.contributed_amount.toLocaleString()}
                            {row.partner_expense_amount > 0 &&
                              ` · Paid on Behalf ${row.partner_expense_amount.toLocaleString()}`}
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
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-brand-600">
                          {row.partner_distributable_share.toLocaleString()}
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

              <Card className="overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-navy-800">
                  <p className="text-sm font-medium text-navy-900 dark:text-slate-100">Contributions</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Every payment this partner has made into a project, in order.
                  </p>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Project</th>
                      <th className="px-4 py-3 font-medium">Purpose</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Narration</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {(!contributions || contributions.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                          No contributions logged yet.
                        </td>
                      </tr>
                    )}
                    {contributions?.map((c) => {
                      const projectName = summary.projects.find(
                        (p) => p.project_id === c.project_id,
                      )?.project_name;
                      return (
                        <tr key={c.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {c.contribution_date}
                          </td>
                          <td className="px-4 py-3 text-navy-900 dark:text-slate-100">
                            {projectName ?? `#${c.project_id}`}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {c.purpose ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                            {c.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {c.narration ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                const ok = await confirm(
                                  `Delete this contribution of PKR ${c.amount.toLocaleString()}?`,
                                  { danger: true, confirmLabel: "Delete" },
                                );
                                if (ok) deleteContribution.mutate(c.id);
                              }}
                              title="Delete contribution"
                              className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-navy-800">
                  <p className="text-sm font-medium text-navy-900 dark:text-slate-100">
                    Expenses Paid on Behalf
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Project expenses this partner paid out of their own pocket — owed back to
                    them.
                  </p>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Project</th>
                      <th className="px-4 py-3 font-medium">Expense Head</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 font-medium">Narration</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {(!partnerExpenses || partnerExpenses.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                          No expenses logged yet.
                        </td>
                      </tr>
                    )}
                    {partnerExpenses?.map((e) => {
                      const projectName = summary.projects.find(
                        (p) => p.project_id === e.project_id,
                      )?.project_name;
                      return (
                        <tr key={e.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {e.expense_date}
                          </td>
                          <td className="px-4 py-3 text-navy-900 dark:text-slate-100">
                            {projectName ?? `#${e.project_id}`}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {e.expense_account.name}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-navy-900 dark:text-slate-100">
                            {e.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                            {e.narration ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={async () => {
                                const ok = await confirm(
                                  `Delete this expense of PKR ${e.amount.toLocaleString()}?`,
                                  { danger: true, confirmLabel: "Delete" },
                                );
                                if (ok) deleteExpense.mutate(e.id);
                              }}
                              title="Delete expense"
                              className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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

      <Modal
        open={contributionModalOpen}
        onClose={() => {
          setContributionModalOpen(false);
          setContributionError(null);
        }}
        title="Log Contribution"
        description="Record money this partner has paid into a project."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setContributionError(null);
            createContribution.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="c_project">Project</Label>
            <Select
              id="c_project"
              required
              value={contributionForm.project_id}
              onChange={(e) => setContributionForm({ ...contributionForm, project_id: e.target.value })}
            >
              <option value="">Select project</option>
              {summary?.projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.project_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="c_date">Date</Label>
            <Input
              id="c_date"
              type="date"
              required
              value={contributionForm.contribution_date || todayIso()}
              onChange={(e) =>
                setContributionForm({ ...contributionForm, contribution_date: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="c_amount">Amount</Label>
            <Input
              id="c_amount"
              type="number"
              required
              value={contributionForm.amount}
              onChange={(e) => setContributionForm({ ...contributionForm, amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="c_purpose">Purpose</Label>
            <Select
              id="c_purpose"
              value={contributionForm.purpose}
              onChange={(e) => setContributionForm({ ...contributionForm, purpose: e.target.value })}
            >
              {CONTRIBUTION_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="c_account">Paid Into</Label>
            <Select
              id="c_account"
              required
              value={contributionForm.debit_account_id}
              onChange={(e) =>
                setContributionForm({ ...contributionForm, debit_account_id: e.target.value })
              }
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
            <Label htmlFor="c_narration">Narration</Label>
            <Input
              id="c_narration"
              value={contributionForm.narration}
              onChange={(e) => setContributionForm({ ...contributionForm, narration: e.target.value })}
            />
          </div>
          {contributionError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{contributionError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setContributionModalOpen(false);
                setContributionError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createContribution.isPending}>
              Record Contribution
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          setExpenseError(null);
        }}
        title="Log Partner Expense"
        description="Record a project expense this partner paid out of their own pocket — creates a payable owed back to them."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setExpenseError(null);
            createExpense.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="e_project">Project</Label>
            <Select
              id="e_project"
              required
              value={expenseForm.project_id}
              onChange={(e) => setExpenseForm({ ...expenseForm, project_id: e.target.value })}
            >
              <option value="">Select project</option>
              {summary?.projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.project_name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="e_date">Date</Label>
            <Input
              id="e_date"
              type="date"
              required
              value={expenseForm.expense_date || todayIso()}
              onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="e_amount">Amount</Label>
            <Input
              id="e_amount"
              type="number"
              required
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="e_account">Expense Head</Label>
            <Select
              id="e_account"
              required
              value={expenseForm.expense_account_id}
              onChange={(e) =>
                setExpenseForm({ ...expenseForm, expense_account_id: e.target.value })
              }
            >
              <option value="">Select expense account</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="e_narration">Narration</Label>
            <Input
              id="e_narration"
              value={expenseForm.narration}
              onChange={(e) => setExpenseForm({ ...expenseForm, narration: e.target.value })}
            />
          </div>
          {expenseError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{expenseError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setExpenseModalOpen(false);
                setExpenseError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createExpense.isPending}>
              Record Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
