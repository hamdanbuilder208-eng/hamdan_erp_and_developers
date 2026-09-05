import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Handshake, Plus, Printer, Trash2, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type { Account, BookingAgent, BookingAgentSummary, CommissionPayout } from "../types";

const emptyForm = {
  name: "",
  contact_info: "",
  linked_account_id: "",
  default_commission_percent: "",
};

const emptyPayoutForm = {
  amount: "",
  credit_account_id: "",
  narration: "",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function BrokersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [selectedAgentId, setSelectedAgentId] = React.useState<number | null>(null);
  const [payoutBookingId, setPayoutBookingId] = React.useState<number | null>(null);
  const [payoutForm, setPayoutForm] = React.useState(emptyPayoutForm);
  const [payoutError, setPayoutError] = React.useState<string | null>(null);

  const { data: agents, isLoading } = useQuery({
    queryKey: ["booking-agents"],
    queryFn: async () => (await api.get<BookingAgent[]>("/booking-agents/")).data,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const { data: summary } = useQuery({
    queryKey: ["booking-agent-summary", selectedAgentId],
    queryFn: async () =>
      (await api.get<BookingAgentSummary>(`/booking-agents/${selectedAgentId}/summary`)).data,
    enabled: !!selectedAgentId,
  });

  const { data: payouts } = useQuery({
    queryKey: ["commission-payouts", selectedAgentId],
    queryFn: async () =>
      (await api.get<CommissionPayout[]>("/commission-payouts/", { params: { agent_id: selectedAgentId } })).data,
    enabled: !!selectedAgentId,
  });

  const deletePayout = useMutation({
    mutationFn: async (id: number) => api.delete(`/commission-payouts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commission-payouts", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["booking-agent-summary", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete payout."));
    },
  });

  const postableAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];

  const createAgent = useMutation({
    mutationFn: async () =>
      (
        await api.post<BookingAgent>("/booking-agents/", {
          name: form.name,
          contact_info: form.contact_info || null,
          linked_account_id: form.linked_account_id ? Number(form.linked_account_id) : null,
          default_commission_percent: form.default_commission_percent
            ? Number(form.default_commission_percent)
            : 0,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-agents"] });
      setModalOpen(false);
      setForm(emptyForm);
    },
  });

  const createPayout = useMutation({
    mutationFn: async () =>
      (
        await api.post("/commission-payouts/", {
          payout_date: todayIso(),
          booking_id: payoutBookingId,
          agent_id: selectedAgentId,
          credit_account_id: Number(payoutForm.credit_account_id),
          amount: Number(payoutForm.amount),
          narration: payoutForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-agent-summary", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["commission-payouts", selectedAgentId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setPayoutBookingId(null);
      setPayoutForm(emptyPayoutForm);
      setPayoutError(null);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setPayoutError(message ?? "Failed to record payout");
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Broker / Agent Commission</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Agents who refer customers, and their commission on each booking.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <p className="px-5 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Loading...</p>}
            {!isLoading && agents?.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                No agents yet. Click "New Agent" to add a broker.
              </p>
            )}
            {agents?.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAgentId(a.id)}
                className={`flex w-full items-center justify-between px-5 py-3 text-left text-sm transition-colors ${
                  selectedAgentId === a.id ? "bg-brand-50" : "hover:bg-slate-50 dark:hover:bg-navy-800/60"
                }`}
              >
                <span>
                  <span className="flex items-center gap-1.5 font-medium text-navy-900 dark:text-slate-100">
                    <Handshake className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    {a.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">{a.agent_code}</span>
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{a.default_commission_percent}%</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="lg:col-span-2">
          {!summary ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">
                Select an agent to view their commission ledger.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Eligible</p>
                    <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">
                      PKR {summary.total_eligible.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Paid</p>
                    <p className="mt-1 text-lg font-semibold text-success-700">
                      PKR {summary.total_paid.toLocaleString()}
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
                      <th className="px-4 py-3 font-medium">Booking</th>
                      <th className="px-4 py-3 font-medium">% Received</th>
                      <th className="px-4 py-3 font-medium">Eligible</th>
                      <th className="px-4 py-3 text-right font-medium">Amount</th>
                      <th className="px-4 py-3 text-right font-medium">Paid</th>
                      <th className="px-4 py-3 text-right font-medium">Balance</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {summary.bookings.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                          No bookings referred by this agent yet.
                        </td>
                      </tr>
                    )}
                    {summary.bookings.map((row) => (
                      <tr key={row.booking_id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                        <td className="px-4 py-3">
                          <p className="font-medium text-navy-900 dark:text-slate-100">{row.booking_ref_no}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {row.unit_number} · {row.allottee_name}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {row.received_percent}%
                        </td>
                        <td className="px-4 py-3">
                          {row.is_eligible ? (
                            <CheckCircle2 className="h-4 w-4 text-success-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-slate-300" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-navy-900 dark:text-slate-100">
                          {row.commission_eligible_amount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-success-700">
                          {row.commission_paid.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-warning-700">
                          {row.commission_balance.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {row.commission_balance > 0 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setPayoutBookingId(row.booking_id);
                                setPayoutForm({
                                  ...emptyPayoutForm,
                                  amount: String(row.commission_balance),
                                });
                              }}
                            >
                              Pay
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {payouts && payouts.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="border-b border-slate-100 dark:border-navy-800 px-4 py-3">
                    <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
                      Payments Made
                    </h3>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Payout #</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Booking</th>
                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                      {payouts.map((p) => (
                        <tr key={p.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                          <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                            {p.payout_no}
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.payout_date}</td>
                          <td className="px-4 py-3 text-navy-900 dark:text-slate-100">
                            {p.booking.booking_ref_no}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-navy-900 dark:text-slate-100">
                            PKR {Number(p.amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => window.open(`/commission-payouts/${p.id}/print`, "_blank")}
                                className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  const ok = await confirm(`Delete payout "${p.payout_no}"?`, {
                                    danger: true,
                                    confirmLabel: "Delete",
                                  });
                                  if (ok) deletePayout.mutate(p.id);
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
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Booking Agent"
        description="Register a broker/agent who refers customers."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createAgent.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="a_name">Agent Name</Label>
            <Input
              id="a_name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="a_contact">Contact Info</Label>
            <Input
              id="a_contact"
              value={form.contact_info}
              onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
              placeholder="Mobile / CNIC / Address"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="a_commission">Default Commission %</Label>
              <Input
                id="a_commission"
                type="number"
                step="0.01"
                value={form.default_commission_percent}
                onChange={(e) => setForm({ ...form, default_commission_percent: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="a_account">Linked Account (optional)</Label>
              <Select
                id="a_account"
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAgent.isPending}>
              Create Agent
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={payoutBookingId !== null}
        onClose={() => {
          setPayoutBookingId(null);
          setPayoutError(null);
        }}
        title="Pay Commission"
        description="Record a partial or full commission withdrawal for this booking."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPayoutError(null);
            createPayout.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="p_amount">Amount</Label>
            <Input
              id="p_amount"
              type="number"
              required
              value={payoutForm.amount}
              onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="p_account">Paid From</Label>
            <Select
              id="p_account"
              required
              value={payoutForm.credit_account_id}
              onChange={(e) => setPayoutForm({ ...payoutForm, credit_account_id: e.target.value })}
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
            <Label htmlFor="p_narration">Narration</Label>
            <Input
              id="p_narration"
              value={payoutForm.narration}
              onChange={(e) => setPayoutForm({ ...payoutForm, narration: e.target.value })}
            />
          </div>
          {payoutError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{payoutError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPayoutBookingId(null);
                setPayoutError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createPayout.isPending}>
              Record Payout
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
