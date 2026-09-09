import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FileText, MessageCircle, Plus, Printer, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { BookingStatusBadge } from "../components/ui/Badge";
import { SendMessageModal } from "../components/communication/SendMessageModal";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type {
  Allottee,
  Booking,
  BookingAgent,
  BookingStatus,
  BookingTransfer,
  ExtraChargesReason,
  Project,
  ScheduleFrequency,
  Unit,
} from "../types";

const statuses: BookingStatus[] = ["Booked", "Confirmed", "Possession Given", "Cancelled"];
const frequencies: ScheduleFrequency[] = ["Monthly", "Quarterly", "Half-Yearly", "Yearly"];
const extraChargesReasons: ExtraChargesReason[] = [
  "East Facing",
  "West Facing",
  "Open",
  "Road Facing",
  "Water",
  "Electricity",
  "Other",
];

const emptyForm = {
  project_id: "",
  unit_id: "",
  allottee_id: "",
  discount: "",
  down_payment_amount: "",
  hasExtraCharges: false,
  extra_charges_amount: "",
  extra_charges_reason: "" as ExtraChargesReason | "",
  no_of_installments: "",
  frequency: "Monthly" as ScheduleFrequency,
  remarks: "",
  booking_agent_id: "",
  agent_commission_percent: "",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function BookingsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [detailBooking, setDetailBooking] = React.useState<Booking | null>(null);
  const [messageOpen, setMessageOpen] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState("");
  const [form, setForm] = React.useState(emptyForm);
  const [formError, setFormError] = React.useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", filterStatus],
    queryFn: async () =>
      (await api.get<Booking[]>("/bookings/", { params: { status_filter: filterStatus || undefined } }))
        .data,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });

  const { data: units } = useQuery({
    queryKey: ["units", "for-booking", form.project_id],
    queryFn: async () =>
      (
        await api.get<Unit[]>("/units/", {
          params: { project_id: Number(form.project_id) },
        })
      ).data,
    enabled: !!form.project_id,
  });
  const availableUnitCount = units?.filter((u) => u.status === "Available").length ?? 0;

  const { data: allottees } = useQuery({
    queryKey: ["allottees"],
    queryFn: async () => (await api.get<Allottee[]>("/allottees/")).data,
  });

  const { data: agents } = useQuery({
    queryKey: ["booking-agents"],
    queryFn: async () => (await api.get<BookingAgent[]>("/booking-agents/")).data,
  });

  const { data: transfers } = useQuery({
    queryKey: ["booking-transfers", detailBooking?.id],
    queryFn: async () =>
      (await api.get<BookingTransfer[]>(`/bookings/${detailBooking!.id}/transfers`)).data,
    enabled: !!detailBooking,
  });

  const selectedUnit = units?.find((u) => u.id === Number(form.unit_id));
  const previewExtraCharges = form.hasExtraCharges ? Number(form.extra_charges_amount) || 0 : 0;
  const previewTotal = selectedUnit
    ? Number(selectedUnit.total_price) - (Number(form.discount) || 0) + previewExtraCharges
    : 0;
  const previewDownPayment = Number(form.down_payment_amount) || 0;
  const previewInstallmentCount = Number(form.no_of_installments) || 0;
  const previewRemaining = Math.max(previewTotal - previewDownPayment - previewExtraCharges, 0);
  const previewPerInstallment =
    previewInstallmentCount > 0 ? previewRemaining / previewInstallmentCount : 0;

  const resetForm = () => {
    setForm(emptyForm);
    setFormError(null);
  };

  const createBooking = useMutation({
    mutationFn: async () =>
      (
        await api.post<Booking>("/bookings/", {
          booking_date: todayIso(),
          project_id: Number(form.project_id),
          unit_id: Number(form.unit_id),
          allottee_id: Number(form.allottee_id),
          status_date: todayIso(),
          discount: form.discount ? Number(form.discount) : 0,
          down_payment_amount: form.down_payment_amount ? Number(form.down_payment_amount) : 0,
          extra_charges_amount: form.hasExtraCharges && form.extra_charges_amount ? Number(form.extra_charges_amount) : 0,
          extra_charges_reason: form.hasExtraCharges && form.extra_charges_reason ? form.extra_charges_reason : null,
          no_of_installments: form.no_of_installments ? Number(form.no_of_installments) : 0,
          frequency: form.frequency,
          remarks: form.remarks || null,
          booking_agent_id: form.booking_agent_id ? Number(form.booking_agent_id) : null,
          agent_commission_percent: form.agent_commission_percent
            ? Number(form.agent_commission_percent)
            : null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(message ?? "Failed to create booking");
    },
  });

  const [agentAssignForm, setAgentAssignForm] = React.useState({
    booking_agent_id: "",
    agent_commission_percent: "",
  });

  React.useEffect(() => {
    if (detailBooking) {
      setAgentAssignForm({
        booking_agent_id: detailBooking.booking_agent_id ? String(detailBooking.booking_agent_id) : "",
        agent_commission_percent:
          detailBooking.agent_commission_percent != null ? String(detailBooking.agent_commission_percent) : "",
      });
    }
  }, [detailBooking?.id]);

  const assignAgent = useMutation({
    mutationFn: async () =>
      (
        await api.put<Booking>(`/bookings/${detailBooking!.id}/agent`, {
          booking_agent_id: agentAssignForm.booking_agent_id ? Number(agentAssignForm.booking_agent_id) : null,
          agent_commission_percent: agentAssignForm.agent_commission_percent
            ? Number(agentAssignForm.agent_commission_percent)
            : null,
        })
      ).data,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["reports", "brokers"] });
      setDetailBooking(updated);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: BookingStatus }) =>
      (
        await api.put<Booking>(`/bookings/${id}/status`, {
          status,
          status_date: todayIso(),
        })
      ).data,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setDetailBooking(updated);
    },
  });

  const deleteBooking = useMutation({
    mutationFn: async (id: number) => api.delete(`/bookings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      setDetailBooking(null);
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete booking."));
    },
  });

  // ---- Transfer ----
  const [transferModalOpen, setTransferModalOpen] = React.useState(false);
  const [transferForm, setTransferForm] = React.useState({ to_allottee_id: "", narration: "" });
  const [transferError, setTransferError] = React.useState<string | null>(null);
  const [letterMenuOpen, setLetterMenuOpen] = React.useState(false);
  const letterMenuButtonRef = React.useRef<HTMLButtonElement>(null);
  const [letterMenuPos, setLetterMenuPos] = React.useState<{
    left: number;
    top?: number;
    bottom?: number;
  }>({ left: 0 });
  const [customLetterOpen, setCustomLetterOpen] = React.useState(false);
  const [customLetterForm, setCustomLetterForm] = React.useState({ subject: "", body: "" });

  const createTransfer = useMutation({
    mutationFn: async () =>
      (
        await api.post<BookingTransfer>(`/bookings/${detailBooking!.id}/transfer`, {
          to_allottee_id: Number(transferForm.to_allottee_id),
          transfer_date: todayIso(),
          narration: transferForm.narration || null,
        })
      ).data,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-transfers", detailBooking?.id] });
      const refreshed = (await api.get<Booking>(`/bookings/${detailBooking!.id}`)).data;
      setDetailBooking(refreshed);
      setTransferModalOpen(false);
      setTransferForm({ to_allottee_id: "", narration: "" });
      setTransferError(null);
    },
    onError: (err: unknown) => setTransferError(apiErrorMessage(err, "Failed to transfer booking")),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Unit Booking</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Reserve a unit against a customer and set up their payment plan.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </div>

      <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-48">
        <option value="">All Statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Booking #</th>
              <th className="px-5 py-3 font-medium">Project / Unit</th>
              <th className="px-5 py-3 font-medium">Allottee</th>
              <th className="px-5 py-3 font-medium">Total Price</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <TableRowsSkeleton rows={4} cols={5} />}
            {!isLoading && bookings?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No bookings yet. Click "New Booking" to reserve a unit.
                </td>
              </tr>
            )}
            {bookings?.map((b) => (
              <tr
                key={b.id}
                onClick={() => setDetailBooking(b)}
                className="cursor-pointer hover:bg-brand-50/40"
              >
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{b.booking_ref_no}</td>
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                  {b.project.project_name} · {b.unit.unit_number}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{b.allottee.name}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">PKR {Number(b.total_price).toLocaleString()}</td>
                <td className="px-5 py-3">
                  <BookingStatusBadge status={b.status} />
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
        title="New Booking"
        description="Book a unit against a customer with a default payment schedule."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            createBooking.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="b_project">Project</Label>
              <Select
                id="b_project"
                required
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value, unit_id: "" })}
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
              <Label htmlFor="b_unit">Unit</Label>
              <Select
                id="b_unit"
                required
                value={form.unit_id}
                onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                disabled={!form.project_id}
              >
                <option value="">Select unit</option>
                {units?.map((u) => (
                  <option key={u.id} value={u.id} disabled={u.status !== "Available"}>
                    {u.unit_number} · PKR {Number(u.total_price).toLocaleString()}
                    {u.status !== "Available" ? ` — ${u.status}` : ""}
                  </option>
                ))}
              </Select>
              {form.project_id && units && units.length > 0 && availableUnitCount === 0 && (
                <p className="mt-1 text-xs text-warning-700">No available units in this project.</p>
              )}
              {form.project_id && units?.length === 0 && (
                <p className="mt-1 text-xs text-warning-700">This project has no units yet.</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="b_allottee">Allottee</Label>
            <Select
              id="b_allottee"
              required
              value={form.allottee_id}
              onChange={(e) => setForm({ ...form, allottee_id: e.target.value })}
            >
              <option value="">Select allottee</option>
              {allottees?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.allottee_code})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="b_discount">Discount (optional)</Label>
            <Input
              id="b_discount"
              type="number"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-navy-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.hasExtraCharges}
                onChange={(e) =>
                  setForm({
                    ...form,
                    hasExtraCharges: e.target.checked,
                    extra_charges_amount: e.target.checked ? form.extra_charges_amount : "",
                    extra_charges_reason: e.target.checked ? form.extra_charges_reason : "",
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Extra Charges
            </label>

            {form.hasExtraCharges && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="b_extra_amount">Amount</Label>
                  <Input
                    id="b_extra_amount"
                    type="number"
                    required
                    value={form.extra_charges_amount}
                    onChange={(e) => setForm({ ...form, extra_charges_amount: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="b_extra_reason">For</Label>
                  <Select
                    id="b_extra_reason"
                    required
                    value={form.extra_charges_reason}
                    onChange={(e) =>
                      setForm({ ...form, extra_charges_reason: e.target.value as ExtraChargesReason })
                    }
                  >
                    <option value="">Select reason</option>
                    {extraChargesReasons.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            )}
          </div>

          {selectedUnit && (
            <div className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
              Total Price: <span className="font-semibold">PKR {previewTotal.toLocaleString()}</span>
            </div>
          )}

          <div className="border-t border-slate-100 dark:border-navy-800 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Booking Agent (optional)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="b_agent">Agent</Label>
                <Select
                  id="b_agent"
                  value={form.booking_agent_id}
                  onChange={(e) => {
                    const agent = agents?.find((a) => a.id === Number(e.target.value));
                    setForm({
                      ...form,
                      booking_agent_id: e.target.value,
                      agent_commission_percent: agent
                        ? String(agent.default_commission_percent)
                        : form.agent_commission_percent,
                    });
                  }}
                >
                  <option value="">— None —</option>
                  {agents?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="b_agent_commission">Commission %</Label>
                <Input
                  id="b_agent_commission"
                  type="number"
                  step="0.01"
                  disabled={!form.booking_agent_id}
                  value={form.agent_commission_percent}
                  onChange={(e) => setForm({ ...form, agent_commission_percent: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-navy-800 pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Payment Plan
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="b_down">Down Payment</Label>
                <Input
                  id="b_down"
                  type="number"
                  value={form.down_payment_amount}
                  onChange={(e) => setForm({ ...form, down_payment_amount: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="b_installments">No. of Installments</Label>
                <Input
                  id="b_installments"
                  type="number"
                  value={form.no_of_installments}
                  onChange={(e) => setForm({ ...form, no_of_installments: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="b_frequency">Frequency</Label>
                <Select
                  id="b_frequency"
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as ScheduleFrequency })}
                >
                  {frequencies.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {(previewDownPayment > 0 || previewInstallmentCount > 0) && (
              <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
                <div>
                  Down Payment: <span className="font-semibold">PKR {previewDownPayment.toLocaleString()}</span>
                </div>
                <div>
                  Remaining: <span className="font-semibold">PKR {previewRemaining.toLocaleString()}</span>
                </div>
                <div>
                  Per Installment:{" "}
                  <span className="font-semibold">
                    {previewInstallmentCount > 0
                      ? `PKR ${previewPerInstallment.toLocaleString(undefined, { maximumFractionDigits: 0 })} × ${previewInstallmentCount}`
                      : "—"}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="b_remarks">Remarks</Label>
            <Input
              id="b_remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
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
            <Button type="submit" disabled={createBooking.isPending}>
              Create Booking
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!detailBooking}
        onClose={() => {
          setDetailBooking(null);
          setMessageOpen(false);
        }}
        title={detailBooking ? `Booking ${detailBooking.booking_ref_no}` : ""}
        description={detailBooking ? `${detailBooking.project.project_name} · ${detailBooking.unit.unit_number}` : ""}
        className="max-w-2xl"
      >
        {detailBooking && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Allottee</p>
                <p className="mt-0.5 font-medium text-navy-900 dark:text-slate-100">{detailBooking.allottee.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Price</p>
                <p className="mt-0.5 font-medium text-navy-900 dark:text-slate-100">
                  PKR {Number(detailBooking.total_price).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                <div className="mt-1">
                  <BookingStatusBadge status={detailBooking.status} />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-navy-800 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Booking Agent
              </p>
              <div className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
                <div>
                  <Label htmlFor="detail_agent">Agent</Label>
                  <Select
                    id="detail_agent"
                    value={agentAssignForm.booking_agent_id}
                    onChange={(e) => {
                      const agent = agents?.find((a) => a.id === Number(e.target.value));
                      setAgentAssignForm({
                        booking_agent_id: e.target.value,
                        agent_commission_percent: agent
                          ? String(agent.default_commission_percent)
                          : "",
                      });
                    }}
                  >
                    <option value="">— None —</option>
                    {agents?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-24">
                  <Label htmlFor="detail_agent_commission">Commission %</Label>
                  <Input
                    id="detail_agent_commission"
                    type="number"
                    step="0.01"
                    disabled={!agentAssignForm.booking_agent_id}
                    value={agentAssignForm.agent_commission_percent}
                    onChange={(e) =>
                      setAgentAssignForm({ ...agentAssignForm, agent_commission_percent: e.target.value })
                    }
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={assignAgent.isPending}
                  onClick={() => assignAgent.mutate()}
                >
                  Save
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <CalendarClock className="h-3.5 w-3.5" />
                Payment Schedule
              </p>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-100 dark:border-navy-800">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Label</th>
                      <th className="px-3 py-2 font-medium">Due Date</th>
                      <th className="px-3 py-2 text-right font-medium">Amount</th>
                      <th className="px-3 py-2 text-right font-medium">Balance</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {detailBooking.schedule_lines.map((line) => {
                      const balance = Number(line.amount) - Number(line.paid_amount);
                      return (
                        <tr key={line.id}>
                          <td className="px-3 py-2 text-navy-800 dark:text-slate-200">{line.label}</td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{line.due_date}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                            {Number(line.amount).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-warning-700">
                            {balance > 0 ? balance.toLocaleString() : "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {balance > 0 && (
                              <button
                                onClick={() =>
                                  window.open(
                                    `/bookings/${detailBooking.id}/schedule-lines/${line.id}/invoice/print`,
                                    "_blank",
                                  )
                                }
                                title="Print Invoice"
                                className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-navy-800 pt-4">
              <div className="flex flex-wrap gap-2">
                {detailBooking.status !== "Confirmed" && detailBooking.status !== "Cancelled" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => updateStatus.mutate({ id: detailBooking.id, status: "Confirmed" })}
                  >
                    Confirm
                  </Button>
                )}
                {detailBooking.status !== "Possession Given" && detailBooking.status !== "Cancelled" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      updateStatus.mutate({ id: detailBooking.id, status: "Possession Given" })
                    }
                  >
                    Mark Possession Given
                  </Button>
                )}
                {detailBooking.status !== "Cancelled" && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      const ok = await confirm(
                        "Cancel this booking? The unit will become Available again.",
                        { danger: true, confirmLabel: "Cancel booking" },
                      );
                      if (ok) updateStatus.mutate({ id: detailBooking.id, status: "Cancelled" });
                    }}
                  >
                    Cancel Booking
                  </Button>
                )}
                {detailBooking.status !== "Cancelled" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setTransferForm({ to_allottee_id: "", narration: "" });
                      setTransferError(null);
                      setTransferModalOpen(true);
                    }}
                  >
                    Transfer Owner
                  </Button>
                )}
                {detailBooking.allottee.mobile && (
                  <Button size="sm" variant="secondary" onClick={() => setMessageOpen(true)}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    Send WhatsApp / SMS
                  </Button>
                )}
                <div className="relative">
                  <Button
                    ref={letterMenuButtonRef}
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const rect = letterMenuButtonRef.current?.getBoundingClientRect();
                      if (rect) {
                        const openUp = window.innerHeight - rect.bottom < 160;
                        setLetterMenuPos({
                          left: rect.left,
                          top: openUp ? undefined : rect.bottom + 4,
                          bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
                        });
                      }
                      setLetterMenuOpen((o) => !o);
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Print Letter ▾
                  </Button>
                  {letterMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setLetterMenuOpen(false)} />
                      <div
                        style={{
                          position: "fixed",
                          left: letterMenuPos.left,
                          top: letterMenuPos.top,
                          bottom: letterMenuPos.bottom,
                        }}
                        className="z-20 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-navy-700 dark:bg-navy-900"
                      >
                        <button
                          onClick={() => {
                            window.open(`/bookings/${detailBooking.id}/letter/allotment/print`, "_blank");
                            setLetterMenuOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-navy-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-navy-800"
                        >
                          Allotment Letter
                        </button>
                        <button
                          disabled={!transfers || transfers.length === 0}
                          title={!transfers || transfers.length === 0 ? "This booking has never been transferred" : undefined}
                          onClick={() => {
                            window.open(`/bookings/${detailBooking.id}/letter/transfer/print`, "_blank");
                            setLetterMenuOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-navy-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-navy-800 dark:disabled:text-slate-600"
                        >
                          Transfer Letter
                        </button>
                        <button
                          disabled={
                            !detailBooking.schedule_lines.every(
                              (l) => Number(l.paid_amount) >= Number(l.amount),
                            )
                          }
                          title={
                            !detailBooking.schedule_lines.every(
                              (l) => Number(l.paid_amount) >= Number(l.amount),
                            )
                              ? "All installments must be fully paid first"
                              : undefined
                          }
                          onClick={() => {
                            window.open(`/bookings/${detailBooking.id}/letter/possession/print`, "_blank");
                            setLetterMenuOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-navy-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-navy-800 dark:disabled:text-slate-600"
                        >
                          Possession Letter
                        </button>
                        <div className="my-1 border-t border-slate-100 dark:border-navy-800" />
                        <button
                          onClick={() => {
                            setCustomLetterForm({
                              subject: `Regarding Unit ${detailBooking.unit.unit_number}, Booking Ref ${detailBooking.booking_ref_no}`,
                              body: `Dear ${detailBooking.allottee.name},\n\n`,
                            });
                            setCustomLetterOpen(true);
                            setLetterMenuOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-navy-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-navy-800"
                        >
                          Custom Letter…
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={async () => {
                  const ok = await confirm("Permanently delete this booking?", {
                    danger: true,
                    confirmLabel: "Delete",
                  });
                  if (ok) deleteBooking.mutate(detailBooking.id);
                }}
                title="Delete booking"
                className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- Transfer Owner Modal ---- */}
      <Modal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Transfer Booking"
        description={
          detailBooking
            ? `Move ${detailBooking.unit.unit_number} (${detailBooking.booking_ref_no}) from ${detailBooking.allottee.name} to a different allottee.`
            : undefined
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTransfer.mutate();
          }}
          className="space-y-4"
        >
          {transferError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{transferError}</p>
          )}
          <div>
            <Label htmlFor="transfer_to">New Allottee</Label>
            <Select
              id="transfer_to"
              required
              value={transferForm.to_allottee_id}
              onChange={(e) => setTransferForm({ ...transferForm, to_allottee_id: e.target.value })}
            >
              <option value="">Select allottee</option>
              {allottees
                ?.filter((a) => a.id !== detailBooking?.allottee_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} {a.cnic ? `(${a.cnic})` : ""}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="transfer_narration">Narration (optional)</Label>
            <Input
              id="transfer_narration"
              value={transferForm.narration}
              onChange={(e) => setTransferForm({ ...transferForm, narration: e.target.value })}
              placeholder="Reason for transfer, agreement ref, etc."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransfer.isPending}>
              Transfer
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Custom Letter Modal ---- */}
      <Modal
        open={customLetterOpen}
        onClose={() => setCustomLetterOpen(false)}
        title="Custom Letter"
        description="Write your own letter for this booking — it prints on the same company letterhead."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!detailBooking) return;
            localStorage.setItem(
              `custom-letter-${detailBooking.id}`,
              JSON.stringify(customLetterForm),
            );
            window.open(`/bookings/${detailBooking.id}/letter/custom/print`, "_blank");
            setCustomLetterOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="custom_letter_subject">Subject</Label>
            <Input
              id="custom_letter_subject"
              required
              value={customLetterForm.subject}
              onChange={(e) => setCustomLetterForm({ ...customLetterForm, subject: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="custom_letter_body">Letter Body</Label>
            <textarea
              id="custom_letter_body"
              required
              rows={10}
              value={customLetterForm.body}
              onChange={(e) => setCustomLetterForm({ ...customLetterForm, body: e.target.value })}
              className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy-950 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCustomLetterOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Print Letter</Button>
          </div>
        </form>
      </Modal>

      {detailBooking && messageOpen && (
        <SendMessageModal
          open={messageOpen}
          onClose={() => setMessageOpen(false)}
          defaultPhone={detailBooking.allottee.mobile ?? ""}
          defaultName={detailBooking.allottee.name}
          defaultMessage={`Dear ${detailBooking.allottee.name}, your booking ${detailBooking.booking_ref_no} for unit ${detailBooking.unit.unit_number} has been confirmed. Total price: PKR ${Number(
            detailBooking.total_price,
          ).toLocaleString()}. Thank you — Hamdan Associates.`}
          relatedType="Booking"
          relatedId={detailBooking.id}
        />
      )}
    </div>
  );
}
