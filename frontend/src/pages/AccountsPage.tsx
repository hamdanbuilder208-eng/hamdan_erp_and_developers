import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { StatusBarChart } from "../components/charts/StatusBarChart";
import { cn } from "../lib/utils";
import type { Account, AccountNature, PartyType } from "../types";

const natures: AccountNature[] = ["Asset", "Liability", "Capital", "Revenue", "Expense"];
const partyTypes: PartyType[] = ["Customer", "Vendor", "Other"];

const natureLabel: Record<AccountNature, string> = {
  Asset: "Asset",
  Liability: "Liability",
  Capital: "Capital",
  Revenue: "Income",
  Expense: "Expense",
};

const natureColorVar: Record<AccountNature, string> = {
  Asset: "var(--color-success-500)",
  Liability: "var(--color-danger-500)",
  Capital: "var(--color-info-500)",
  Revenue: "var(--color-onhold-500)",
  Expense: "var(--color-warning-500)",
};

const natureBadgeClass: Record<AccountNature, string> = {
  Asset: "bg-success-50 text-success-700",
  Liability: "bg-danger-50 text-danger-700",
  Capital: "bg-info-50 text-info-700",
  Revenue: "bg-onhold-50 text-onhold-700",
  Expense: "bg-warning-50 text-warning-700",
};

const emptyForm = {
  name: "",
  parent_id: "",
  nature: "Asset" as AccountNature,
  is_control: false,
  party_type: "",
  opening_amount: "",
  opening_side: "debit" as "debit" | "credit",
  credit_days: "",
};

function AccountRow({
  account,
  accounts,
  depth,
}: {
  account: Account;
  accounts: Account[];
  depth: number;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const children = accounts.filter((a) => a.parent_id === account.id);
  const hasChildren = children.length > 0;

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-navy-800/60">
        <td className="py-2.5 pr-3" style={{ paddingLeft: `${depth * 20 + 20}px` }}>
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              <button onClick={() => setExpanded(!expanded)} className="text-slate-400 dark:text-slate-500 hover:text-navy-700 dark:text-slate-300">
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            <span className={cn("text-sm", account.is_control ? "font-semibold text-navy-950 dark:text-white" : "text-navy-800 dark:text-slate-200")}>
              {account.name}
            </span>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              natureBadgeClass[account.nature],
            )}
          >
            {natureLabel[account.nature]}
          </span>
        </td>
        <td className="px-5 py-2.5 text-right text-sm font-medium tabular-nums text-navy-900 dark:text-slate-100">
          {account.balance !== 0 ? `PKR ${Math.abs(account.balance).toLocaleString()}` : "—"}
        </td>
      </tr>
      {expanded &&
        children.map((child) => (
          <AccountRow key={child.id} account={child} accounts={accounts} depth={depth + 1} />
        ))}
    </>
  );
}

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      const amount = form.opening_amount ? Number(form.opening_amount) : 0;
      return (
        await api.post<Account>("/accounts/", {
          name: form.name,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          nature: form.nature,
          is_control: form.is_control,
          party_type: form.party_type || null,
          opening_debit: form.opening_side === "debit" ? amount : 0,
          opening_credit: form.opening_side === "credit" ? amount : 0,
          credit_days: form.credit_days ? Number(form.credit_days) : null,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setModalOpen(false);
      setForm(emptyForm);
    },
  });

  const rootAccounts = accounts?.filter((a) => a.parent_id === null) ?? [];

  const natureChartData = natures.map((nature) => ({
    label: natureLabel[nature],
    value: (accounts ?? [])
      .filter((a) => a.nature === nature && !a.is_control)
      .reduce((sum, a) => sum + Math.abs(a.balance), 0),
    colorVar: natureColorVar[nature],
  }));
  const natureTotal = natureChartData.reduce((sum, d) => sum + d.value, 0);
  const hasActivity = natureTotal > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Chart of Accounts</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            All your accounts — bank, cash, income and expenses — in one place.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Balance by Account Type</CardTitle>
        </CardHeader>
        <CardContent>
          {hasActivity ? (
            <StatusBarChart
              data={natureChartData}
              total={natureTotal}
              labelWidth="w-16"
              formatValue={(v) => `PKR ${v.toLocaleString()}`}
            />
          ) : (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No postings yet. Balances appear here once vouchers are recorded.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="py-3 pl-5 font-medium">Account</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-5 py-3 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && rootAccounts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No accounts yet.
                </td>
              </tr>
            )}
            {rootAccounts.map((acc) => (
              <AccountRow key={acc.id} account={acc} accounts={accounts ?? []} depth={0} />
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Account"
        description="e.g. a bank account, an expense category, or an income head."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createAccount.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="acc_name">Account Name</Label>
            <Input
              id="acc_name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. HBL Bank Account"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="acc_nature">Type</Label>
              <Select
                id="acc_nature"
                value={form.nature}
                onChange={(e) =>
                  setForm({ ...form, nature: e.target.value as AccountNature, parent_id: "" })
                }
              >
                {natures.map((n) => (
                  <option key={n} value={n}>
                    {natureLabel[n]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="acc_parent">Group Under (optional)</Label>
              <Select
                id="acc_parent"
                value={form.parent_id}
                onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
              >
                <option value="">— Top level —</option>
                {accounts
                  ?.filter((a) => a.nature === form.nature)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="acc_opening_amount">Opening Balance (optional)</Label>
            <div className="flex gap-2">
              <Input
                id="acc_opening_amount"
                type="number"
                value={form.opening_amount}
                onChange={(e) => setForm({ ...form, opening_amount: e.target.value })}
                placeholder="0"
                className="flex-1"
              />
              <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-navy-700">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, opening_side: "debit" })}
                  className={cn(
                    "px-3 text-sm font-medium transition-colors",
                    form.opening_side === "debit"
                      ? "bg-brand-600 text-white"
                      : "bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/60",
                  )}
                >
                  I have
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, opening_side: "credit" })}
                  className={cn(
                    "px-3 text-sm font-medium transition-colors",
                    form.opening_side === "credit"
                      ? "bg-brand-600 text-white"
                      : "bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/60",
                  )}
                >
                  I owe
                </button>
              </div>
            </div>
          </div>

          <details className="group rounded-lg border border-slate-100 dark:border-navy-800">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-navy-700 dark:text-slate-300">
              Advanced options
            </summary>
            <div className="space-y-4 border-t border-slate-100 dark:border-navy-800 px-3 py-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="acc_party">Party Type</Label>
                  <Select
                    id="acc_party"
                    value={form.party_type}
                    onChange={(e) => setForm({ ...form, party_type: e.target.value })}
                  >
                    <option value="">— None —</option>
                    {partyTypes.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="acc_credit_days">Credit Days</Label>
                  <Input
                    id="acc_credit_days"
                    type="number"
                    value={form.credit_days}
                    onChange={(e) => setForm({ ...form, credit_days: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-navy-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={form.is_control}
                  onChange={(e) => setForm({ ...form, is_control: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                This is a group heading (not used for direct postings)
              </label>
            </div>
          </details>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAccount.isPending}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
