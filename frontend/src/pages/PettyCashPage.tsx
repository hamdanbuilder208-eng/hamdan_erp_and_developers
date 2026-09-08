import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Printer, Trash2, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type {
  Account,
  Material,
  PettyCashExpense,
  PettyCashFloat,
  PettyCashTopup,
  Project,
  Warehouse,
} from "../types";

type PettyCashTab = "floats" | "topups" | "expenses";

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function PettyCashPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<PettyCashTab>("floats");

  const { data: floats, isLoading: floatsLoading } = useQuery({
    queryKey: ["petty-cash-floats"],
    queryFn: async () => (await api.get<PettyCashFloat[]>("/petty-cash/floats")).data,
  });
  const { data: topups, isLoading: topupsLoading } = useQuery({
    queryKey: ["petty-cash-topups"],
    queryFn: async () => (await api.get<PettyCashTopup[]>("/petty-cash/topups")).data,
    enabled: tab === "topups",
  });
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ["petty-cash-expenses"],
    queryFn: async () => (await api.get<PettyCashExpense[]>("/petty-cash/expenses")).data,
    enabled: tab === "expenses",
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });
  const { data: materials } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await api.get<Material[]>("/inventory/materials")).data,
    enabled: tab === "expenses",
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get<Warehouse[]>("/inventory/warehouses")).data,
    enabled: tab === "expenses",
  });

  const cashAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];
  const activeFloats = floats?.filter((f) => f.is_active) ?? [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["petty-cash-floats"] });
    queryClient.invalidateQueries({ queryKey: ["petty-cash-topups"] });
    queryClient.invalidateQueries({ queryKey: ["petty-cash-expenses"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  // ---- Float ----
  const [floatModalOpen, setFloatModalOpen] = React.useState(false);
  const [floatForm, setFloatForm] = React.useState({ holder_name: "", opening_balance: "" });
  const [floatError, setFloatError] = React.useState<string | null>(null);

  const createFloat = useMutation({
    mutationFn: async () =>
      (
        await api.post<PettyCashFloat>("/petty-cash/floats", {
          holder_name: floatForm.holder_name,
          opening_balance: floatForm.opening_balance ? Number(floatForm.opening_balance) : 0,
        })
      ).data,
    onSuccess: () => {
      invalidateAll();
      setFloatModalOpen(false);
      setFloatForm({ holder_name: "", opening_balance: "" });
      setFloatError(null);
    },
    onError: (err: unknown) => setFloatError(apiErrorMessage(err, "Failed to create float")),
  });

  const deleteFloat = useMutation({
    mutationFn: async (id: number) => api.delete(`/petty-cash/floats/${id}`),
    onSuccess: invalidateAll,
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete float.")),
  });

  // ---- Top-up ----
  const [topupModalOpen, setTopupModalOpen] = React.useState(false);
  const [topupForm, setTopupForm] = React.useState({
    float_id: "",
    amount: "",
    paid_from_id: "",
    narration: "",
  });
  const [topupError, setTopupError] = React.useState<string | null>(null);

  const createTopup = useMutation({
    mutationFn: async () =>
      (
        await api.post<PettyCashTopup>("/petty-cash/topups", {
          topup_date: todayIso(),
          float_id: Number(topupForm.float_id),
          amount: Number(topupForm.amount),
          paid_from_id: Number(topupForm.paid_from_id),
          narration: topupForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      invalidateAll();
      setTopupModalOpen(false);
      setTopupForm({ float_id: "", amount: "", paid_from_id: "", narration: "" });
      setTopupError(null);
    },
    onError: (err: unknown) => setTopupError(apiErrorMessage(err, "Failed to record top-up")),
  });

  const deleteTopup = useMutation({
    mutationFn: async (id: number) => api.delete(`/petty-cash/topups/${id}`),
    onSuccess: invalidateAll,
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete top-up.")),
  });

  // ---- Expense ----
  const [expenseModalOpen, setExpenseModalOpen] = React.useState(false);
  const [expenseForm, setExpenseForm] = React.useState({
    float_id: "",
    description: "",
    project_id: "",
    isMaterial: false,
    material_id: "",
    quantity: "",
    rate: "",
    warehouse_id: "",
    amount: "",
  });
  const [expenseError, setExpenseError] = React.useState<string | null>(null);

  const resetExpenseForm = () => {
    setExpenseForm({
      float_id: "", description: "", project_id: "", isMaterial: false,
      material_id: "", quantity: "", rate: "", warehouse_id: "", amount: "",
    });
    setExpenseError(null);
  };

  const selectedFloat = floats?.find((f) => f.id === Number(expenseForm.float_id));
  const materialExpensePreview =
    expenseForm.isMaterial && Number(expenseForm.quantity) > 0 && Number(expenseForm.rate) >= 0
      ? Number(expenseForm.quantity) * Number(expenseForm.rate)
      : null;

  const createExpense = useMutation({
    mutationFn: async () =>
      (
        await api.post<PettyCashExpense>("/petty-cash/expenses", {
          expense_date: todayIso(),
          float_id: Number(expenseForm.float_id),
          description: expenseForm.description,
          project_id: expenseForm.project_id ? Number(expenseForm.project_id) : null,
          material_id: expenseForm.isMaterial && expenseForm.material_id ? Number(expenseForm.material_id) : null,
          quantity: expenseForm.isMaterial && expenseForm.quantity ? Number(expenseForm.quantity) : null,
          rate: expenseForm.isMaterial && expenseForm.rate ? Number(expenseForm.rate) : null,
          warehouse_id: expenseForm.isMaterial && expenseForm.warehouse_id ? Number(expenseForm.warehouse_id) : null,
          amount: !expenseForm.isMaterial && expenseForm.amount ? Number(expenseForm.amount) : null,
        })
      ).data,
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-by-project"] });
      setExpenseModalOpen(false);
      resetExpenseForm();
    },
    onError: (err: unknown) => setExpenseError(apiErrorMessage(err, "Failed to record expense")),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: number) => api.delete(`/petty-cash/expenses/${id}`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      queryClient.invalidateQueries({ queryKey: ["stock-by-project"] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete expense.")),
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Petty Cash</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Cash floats handed to office staff or a site — top them up, and track every small spend
          against the person and (when it's for a project) the project.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-navy-700">
        {(
          [
            { key: "floats", label: "Floats" },
            { key: "topups", label: "Top-ups" },
            { key: "expenses", label: "Expenses" },
          ] as { key: PettyCashTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "floats" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Floats</h3>
            <Button size="sm" onClick={() => setFloatModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Float
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Float #</th>
                  <th className="px-5 py-3 font-medium">Holder</th>
                  <th className="px-5 py-3 text-right font-medium">Current Balance</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {floatsLoading && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}
                {!floatsLoading && floats?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No floats yet. Add one to start handing out petty cash.
                    </td>
                  </tr>
                )}
                {floats?.map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {f.float_code}
                    </td>
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{f.holder_name}</td>
                    <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                      PKR {f.account.balance.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={async () => {
                          const ok = await confirm(`Delete float "${f.holder_name}"?`, {
                            danger: true,
                            confirmLabel: "Delete",
                          });
                          if (ok) deleteFloat.mutate(f.id);
                        }}
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "topups" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Top-ups</h3>
            <Button size="sm" onClick={() => setTopupModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Top-up
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Top-up #</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Float</th>
                  <th className="px-5 py-3 font-medium">Paid From</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {topupsLoading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}
                {!topupsLoading && topups?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No top-ups yet.
                    </td>
                  </tr>
                )}
                {topups?.map((t) => (
                  <tr key={t.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {t.topup_no}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{t.topup_date}</td>
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{t.float.holder_name}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{t.paid_from.name}</td>
                    <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                      PKR {t.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => window.open(`/petty-cash/topup/${t.id}/print`, "_blank")}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm(`Delete top-up "${t.topup_no}"?`, {
                              danger: true,
                              confirmLabel: "Delete",
                            });
                            if (ok) deleteTopup.mutate(t.id);
                          }}
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
          </div>
        </Card>
      )}

      {tab === "expenses" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Expenses</h3>
            <Button size="sm" onClick={() => setExpenseModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Expense
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Expense #</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Float</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {expensesLoading && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}
                {!expensesLoading && expenses?.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No expenses recorded yet.
                    </td>
                  </tr>
                )}
                {expenses?.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {e.expense_no}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{e.expense_date}</td>
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{e.float.holder_name}</td>
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                      {e.description}
                      {e.material && (
                        <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">
                          ({e.quantity} {e.material.unit_of_measure} {e.material.name})
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {e.project?.project_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                      PKR {e.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => window.open(`/petty-cash/expense/${e.id}/print`, "_blank")}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm(`Delete expense "${e.expense_no}"?`, {
                              danger: true,
                              confirmLabel: "Delete",
                            });
                            if (ok) deleteExpense.mutate(e.id);
                          }}
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
          </div>
        </Card>
      )}

      {/* ---- New Float Modal ---- */}
      <Modal
        open={floatModalOpen}
        onClose={() => setFloatModalOpen(false)}
        title="New Petty Cash Float"
        description="Give a name to whoever is holding the cash — an office boy, a site supervisor, etc."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createFloat.mutate();
          }}
          className="space-y-4"
        >
          {floatError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{floatError}</p>
          )}
          <div>
            <Label htmlFor="float_holder">Holder Name</Label>
            <Input
              id="float_holder"
              required
              value={floatForm.holder_name}
              onChange={(e) => setFloatForm({ ...floatForm, holder_name: e.target.value })}
              placeholder="e.g. Ahmed - Office"
            />
          </div>
          <div>
            <Label htmlFor="float_opening">Opening Balance (optional)</Label>
            <Input
              id="float_opening"
              type="number"
              step="0.01"
              min="0"
              value={floatForm.opening_balance}
              onChange={(e) => setFloatForm({ ...floatForm, opening_balance: e.target.value })}
              placeholder="Cash already with them, if any"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setFloatModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFloat.isPending}>
              Create Float
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- New Top-up Modal ---- */}
      <Modal
        open={topupModalOpen}
        onClose={() => setTopupModalOpen(false)}
        title="New Top-up"
        description="Hand more cash to a float."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTopup.mutate();
          }}
          className="space-y-4"
        >
          {topupError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{topupError}</p>
          )}
          <div>
            <Label htmlFor="topup_float">Float</Label>
            <Select
              id="topup_float"
              required
              value={topupForm.float_id}
              onChange={(e) => setTopupForm({ ...topupForm, float_id: e.target.value })}
            >
              <option value="">Select float</option>
              {activeFloats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.holder_name} (current: PKR {f.account.balance.toLocaleString()})
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="topup_amount">Amount</Label>
              <Input
                id="topup_amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={topupForm.amount}
                onChange={(e) => setTopupForm({ ...topupForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="topup_paid_from">Paid From</Label>
              <Select
                id="topup_paid_from"
                required
                value={topupForm.paid_from_id}
                onChange={(e) => setTopupForm({ ...topupForm, paid_from_id: e.target.value })}
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
          <div>
            <Label htmlFor="topup_narration">Narration (optional)</Label>
            <Input
              id="topup_narration"
              value={topupForm.narration}
              onChange={(e) => setTopupForm({ ...topupForm, narration: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTopupModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTopup.isPending}>
              Record Top-up
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- New Expense Modal ---- */}
      <Modal
        open={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          resetExpenseForm();
        }}
        title="New Petty Cash Expense"
        description="Record something the float-holder spent on."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createExpense.mutate();
          }}
          className="space-y-4"
        >
          {expenseError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{expenseError}</p>
          )}
          <div>
            <Label htmlFor="exp_float">Float</Label>
            <Select
              id="exp_float"
              required
              value={expenseForm.float_id}
              onChange={(e) => setExpenseForm({ ...expenseForm, float_id: e.target.value })}
            >
              <option value="">Select float</option>
              {activeFloats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.holder_name} (current: PKR {f.account.balance.toLocaleString()})
                </option>
              ))}
            </Select>
            {selectedFloat && (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Available: PKR {selectedFloat.account.balance.toLocaleString()}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="exp_description">Description</Label>
            <Input
              id="exp_description"
              required
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              placeholder="e.g. Chai, transport, 5 bags of cement"
            />
          </div>
          <div>
            <Label htmlFor="exp_project">Project (optional)</Label>
            <Select
              id="exp_project"
              value={expenseForm.project_id}
              onChange={(e) => setExpenseForm({ ...expenseForm, project_id: e.target.value })}
            >
              <option value="">— General (not project-specific) —</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-navy-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={expenseForm.isMaterial}
              onChange={(e) =>
                setExpenseForm({ ...expenseForm, isMaterial: e.target.checked, amount: "" })
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            This was a material purchase — add it to stock
          </label>

          {expenseForm.isMaterial ? (
            <div className="space-y-4 rounded-lg border border-slate-200 p-3 dark:border-navy-700">
              <div>
                <Label htmlFor="exp_material">Material</Label>
                <Select
                  id="exp_material"
                  required
                  value={expenseForm.material_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, material_id: e.target.value })}
                >
                  <option value="">Select material</option>
                  {materials?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit_of_measure})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="exp_qty">Quantity</Label>
                  <Input
                    id="exp_qty"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={expenseForm.quantity}
                    onChange={(e) => setExpenseForm({ ...expenseForm, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="exp_rate">Rate (per unit)</Label>
                  <Input
                    id="exp_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={expenseForm.rate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, rate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="exp_warehouse">Goes Into (optional)</Label>
                <Select
                  id="exp_warehouse"
                  value={expenseForm.warehouse_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, warehouse_id: e.target.value })}
                >
                  <option value="">Directly at the project site</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_code} — {w.name}
                    </option>
                  ))}
                </Select>
              </div>
              {materialExpensePreview !== null && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Amount: PKR {materialExpensePreview.toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label htmlFor="exp_amount">Amount</Label>
              <Input
                id="exp_amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setExpenseModalOpen(false);
                resetExpenseForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createExpense.isPending}>
              <Wallet className="h-4 w-4" />
              Record Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
