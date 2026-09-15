import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, FileText, MessageCircle, Plus, Printer, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge, BookingStatusBadge } from "../components/ui/Badge";
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
  PaymentTemplate,
  Project,
  Refund,
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
  "Corner",
  "Water",
  "Electricity",
  "Documents",
  "Other",
];

type InstallmentPlanForm = {
  label: string;
  frequency: ScheduleFrequency;
  no_of_installments: string;
  total_amount: string;
  start_date: string;
};

const emptyInstallmentPlan = (): InstallmentPlanForm => ({
  label: "Monthly Installments",
  frequency: "Monthly",
  no_of_installments: "",
  total_amount: "",
  start_date: "",
});

type ExtraChargeForm = {
  reason: ExtraChargesReason;
  amount: string;
  narration: string;
};

const emptyExtraCharge = (): ExtraChargeForm => ({
  reason: "Road Facing",
  amount: "",
  narration: "",
});

const emptyForm = {
  project_id: "",
  unit_id: "",
  allottee_id: "",
  discount: "",
  down_payment_amount: "",
  extraCharges: [] as ExtraChargeForm[],
  installmentPlans: [] as InstallmentPlanForm[],
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
  const [filterProject, setFilterProject] = React.useState("");
  const [form, setForm] = React.useState(emptyForm);
  const [formError, setFormError] = React.useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", filterStatus, filterProject],
    queryFn: async () =>
      (
        await api.get<Booking[]>("/bookings/", {
          params: {
            status_filter: filterStatus || undefined,
            project_id: filterProject ? Number(filterProject) : undefined,
          },
        })
      ).data,
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

  const { data: paymentTemplate } = useQuery({
    queryKey: ["payment-template", form.project_id],
    queryFn: async () =>
      (await api.get<PaymentTemplate | null>(`/projects/${form.project_id}/payment-template`)).data,
    enabled: !!form.project_id,
  });

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

  // Cancelled bookings that had payments made get an automatic refund
  // record (see the backend's cancel flow) — surface it here so it's clear
  // what the customer paid and whether that's been paid back yet.
  const { data: bookingRefunds } = useQuery({
    queryKey: ["refunds", "booking", detailBooking?.id],
    queryFn: async () =>
      (await api.get<Refund[]>("/refunds/", { params: { booking_id: detailBooking!.id } })).data,
    enabled: !!detailBooking && detailBooking.status === "Cancelled",
  });
  const bookingRefund = bookingRefunds?.[0];

  const selectedUnit = units?.find((u) => u.id === Number(form.unit_id));
  const previewExtraCharges = form.extraCharges.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const previewTotal = selectedUnit
    ? Number(selectedUnit.total_price) - (Number(form.discount) || 0) + previewExtraCharges
    : 0;
  const previewDownPayment = Number(form.down_payment_amount) || 0;
  const previewPlansTotal = form.installmentPlans.reduce((s, p) => s + (Number(p.total_amount) || 0), 0);
  const previewRemaining = previewTotal - previewDownPayment - previewExtraCharges;
  const previewBalance = Math.round((previewRemaining - previewPlansTotal) * 100) / 100;

  const resetForm = () => {
    setForm(emptyForm);
    setFormError(null);
  };

  const addInstallmentPlan = () =>
    setForm({ ...form, installmentPlans: [...form.installmentPlans, emptyInstallmentPlan()] });
  const removeInstallmentPlan = (idx: number) =>
    setForm({ ...form, installmentPlans: form.installmentPlans.filter((_, i) => i !== idx) });
  const updateInstallmentPlan = (idx: number, patch: Partial<InstallmentPlanForm>) =>
    setForm({
      ...form,
      installmentPlans: form.installmentPlans.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    });

  const applyStandardSchedule = () => {
    if (!paymentTemplate || !selectedUnit) return;
    const basePrice = Number(selectedUnit.total_price) - (Number(form.discount) || 0);
    const downPayment = Math.round(((basePrice * Number(paymentTemplate.booking_percent)) / 100) * 100) / 100;
    const remaining = basePrice - downPayment;

    let allocated = 0;
    const plans = paymentTemplate.lines.map((line, idx) => {
      let amount = Math.round(((basePrice * Number(line.percent)) / 100) * 100) / 100;
      if (idx === paymentTemplate.lines.length - 1) {
        amount = Math.round((remaining - allocated) * 100) / 100;
      }
      allocated += amount;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + line.months_after_booking);
      return {
        label: line.label,
        frequency: line.frequency,
        no_of_installments: String(line.no_of_installments),
        total_amount: String(amount),
        start_date: startDate.toISOString().slice(0, 10),
      };
    });

    setForm({ ...form, down_payment_amount: String(downPayment), installmentPlans: plans });
  };

  const addExtraCharge = () => setForm({ ...form, extraCharges: [...form.extraCharges, emptyExtraCharge()] });
  const removeExtraCharge = (idx: number) =>
    setForm({ ...form, extraCharges: form.extraCharges.filter((_, i) => i !== idx) });
  const updateExtraCharge = (idx: number, patch: Partial<ExtraChargeForm>) =>
    setForm({
      ...form,
      extraCharges: form.extraCharges.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });

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
          extra_charges: form.extraCharges.map((c) => ({
            reason: c.reason,
            amount: Number(c.amount) || 0,
            charge_date: todayIso(),
            narration: c.narration || null,
          })),
          installment_plans: form.installmentPlans.map((p) => ({
            label: p.label || "Installments",
            frequency: p.frequency,
            no_of_installments: Number(p.no_of_installments) || 0,
            total_amount: Number(p.total_amount) || 0,
            start_date: p.start_date,
          })),
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
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
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

  // ---- Extra charges added after booking (e.g. utilities/documents, once known) ----
  const [extraChargeModalOpen, setExtraChargeModalOpen] = React.useState(false);
  const [extraChargeForm, setExtraChargeForm] = React.useState(emptyExtraCharge());
  const [extraChargeError, setExtraChargeError] = React.useState<string | null>(null);

  const addExtraChargeToBooking = useMutation({
    mutationFn: async () =>
      (
        await api.post<Booking>(`/bookings/${detailBooking!.id}/extra-charges`, {
          reason: extraChargeForm.reason,
          amount: Number(extraChargeForm.amount) || 0,
          charge_date: todayIso(),
          narration: extraChargeForm.narration || null,
        })
      ).data,
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setDetailBooking(updated);
      setExtraChargeModalOpen(false);
      setExtraChargeForm(emptyExtraCharge());
      setExtraChargeError(null);
      toast.success("Extra charge added.");
    },
    onError: (err: unknown) => setExtraChargeError(apiErrorMessage(err, "Failed to add extra charge.")),
  });

  const deleteExtraCharge = useMutation({
    mutationFn: async (chargeId: number) => api.delete(`/bookings/extra-charges/${chargeId}`),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      const refreshed = (await api.get<Booking>(`/bookings/${detailBooking!.id}`)).data;
      setDetailBooking(refreshed);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete extra charge.")),
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

      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-48">
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="w-48">
          <option value="">All Projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name}
            </option>
          ))}
        </Select>
      </div>

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
            <Label>Extra Charges (optional)</Label>
            <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
              Add one line per charge — a flat can be corner-facing AND have separate utilities/documents
              charges. Utilities and documents charges are usually only known later — add those from the
              booking's detail view once the project reaches that stage instead of guessing now.
            </p>
            <div className="space-y-2">
              {form.extraCharges.map((charge, idx) => (
                <div key={idx} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Select
                      value={charge.reason}
                      onChange={(e) => updateExtraCharge(idx, { reason: e.target.value as ExtraChargesReason })}
                    >
                      {extraChargesReasons.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-32">
                    <Input
                      type="number"
                      required
                      placeholder="Amount"
                      value={charge.amount}
                      onChange={(e) => updateExtraCharge(idx, { amount: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExtraCharge(idx)}
                    className="mb-2 rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addExtraCharge}>
                <Plus className="h-3.5 w-3.5" />
                Add Extra Charge
              </Button>
            </div>
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
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Payment Plan
              </p>
              {paymentTemplate && selectedUnit && (
                <Button type="button" size="sm" variant="secondary" onClick={applyStandardSchedule}>
                  Use Standard Schedule
                </Button>
              )}
            </div>
            <div>
              <Label htmlFor="b_down">Down Payment</Label>
              <Input
                id="b_down"
                type="number"
                value={form.down_payment_amount}
                onChange={(e) => setForm({ ...form, down_payment_amount: e.target.value })}
              />
            </div>

            <div className="mt-3 space-y-3">
              {form.installmentPlans.map((plan, idx) => {
                const count = Number(plan.no_of_installments) || 0;
                const amount = Number(plan.total_amount) || 0;
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 p-3 dark:border-navy-700"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Installment Plan {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeInstallmentPlan(idx)}
                        className="rounded-md p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`plan_label_${idx}`}>Label</Label>
                        <Input
                          id={`plan_label_${idx}`}
                          required
                          value={plan.label}
                          onChange={(e) => updateInstallmentPlan(idx, { label: e.target.value })}
                          placeholder="e.g. Monthly Installments"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`plan_frequency_${idx}`}>Frequency</Label>
                        <Select
                          id={`plan_frequency_${idx}`}
                          value={plan.frequency}
                          onChange={(e) =>
                            updateInstallmentPlan(idx, { frequency: e.target.value as ScheduleFrequency })
                          }
                        >
                          {frequencies.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor={`plan_count_${idx}`}>No. of Installments</Label>
                        <Input
                          id={`plan_count_${idx}`}
                          type="number"
                          required
                          value={plan.no_of_installments}
                          onChange={(e) => updateInstallmentPlan(idx, { no_of_installments: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`plan_amount_${idx}`}>Total Amount</Label>
                        <Input
                          id={`plan_amount_${idx}`}
                          type="number"
                          required
                          value={plan.total_amount}
                          onChange={(e) => updateInstallmentPlan(idx, { total_amount: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`plan_start_${idx}`}>First Installment Due</Label>
                        <Input
                          id={`plan_start_${idx}`}
                          type="date"
                          required
                          value={plan.start_date}
                          onChange={(e) => updateInstallmentPlan(idx, { start_date: e.target.value })}
                        />
                      </div>
                    </div>
                    {count > 0 && amount > 0 && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        PKR {(amount / count).toLocaleString(undefined, { maximumFractionDigits: 0 })} ×{" "}
                        {count}, {plan.frequency.toLowerCase()}
                      </p>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="secondary" size="sm" onClick={addInstallmentPlan}>
                <Plus className="h-3.5 w-3.5" />
                Add Installment Plan
              </Button>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Add one plan per installment frequency — e.g. a Monthly plan and a Half-Yearly plan
                running side by side for a client paying both.
              </p>
            </div>

            {(previewDownPayment > 0 || previewPlansTotal > 0) && (
              <div className="mt-3 grid grid-cols-4 gap-3 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
                <div>
                  Total: <span className="font-semibold">PKR {previewTotal.toLocaleString()}</span>
                </div>
                <div>
                  Down Payment: <span className="font-semibold">PKR {previewDownPayment.toLocaleString()}</span>
                </div>
                <div>
                  Plans Total: <span className="font-semibold">PKR {previewPlansTotal.toLocaleString()}</span>
                </div>
                <div className={previewBalance !== 0 ? "font-semibold text-danger-700" : "font-semibold"}>
                  {previewBalance === 0 ? "Balanced" : `Unmatched: PKR ${previewBalance.toLocaleString()}`}
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

            {detailBooking.status === "Cancelled" && bookingRefund && (
              <div className="rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-navy-700">
                <div className="flex items-center justify-between">
                  <span className="text-navy-900 dark:text-slate-100">
                    Refund owed to {detailBooking.allottee.name}: PKR{" "}
                    {Number(bookingRefund.gross_amount).toLocaleString()}
                  </span>
                  <Badge tone={bookingRefund.status === "Paid" ? "success" : "warning"}>
                    {bookingRefund.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {bookingRefund.status === "Pending" &&
                    "This was paid before cancellation and is tracked as a pending refund — pay it out from the Refunds tab."}
                  {bookingRefund.status === "Partially Paid" &&
                    `Partially paid out under ${bookingRefund.refund_no} — continue it from the Refunds tab.`}
                  {bookingRefund.status === "Paid" && `Paid out in full as ${bookingRefund.refund_no}.`}
                </p>
              </div>
            )}

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
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Extra Charges
                </p>
                {detailBooking.status !== "Cancelled" && (
                  <Button size="sm" variant="secondary" onClick={() => setExtraChargeModalOpen(true)}>
                    <Plus className="h-3.5 w-3.5" />
                    Add Extra Charge
                  </Button>
                )}
              </div>
              {detailBooking.extra_charges.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  None yet — add one any time (e.g. once utilities/documents charges are known).
                </p>
              ) : (
                <div className="space-y-1.5">
                  {detailBooking.extra_charges.map((c) => {
                    const line = detailBooking.schedule_lines.find((l) => l.id === c.schedule_line_id);
                    const paid = line ? Number(line.paid_amount) > 0 : false;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-navy-800"
                      >
                        <span className="text-navy-900 dark:text-slate-100">
                          {c.reason} · PKR {Number(c.amount).toLocaleString()} · {c.charge_date}
                        </span>
                        {!paid && (
                          <button
                            onClick={async () => {
                              const ok = await confirm(`Remove "${c.reason}" charge?`, {
                                danger: true,
                                confirmLabel: "Remove",
                              });
                              if (ok) deleteExtraCharge.mutate(c.id);
                            }}
                            className="rounded-md p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                      const paidSoFar = detailBooking.schedule_lines.reduce(
                        (s, l) => s + Number(l.paid_amount),
                        0,
                      );
                      const ok = await confirm(
                        paidSoFar > 0
                          ? `Cancel this booking? The unit will become Available again, and a pending refund of PKR ${paidSoFar.toLocaleString()} will be tracked in the Refunds tab.`
                          : "Cancel this booking? The unit will become Available again.",
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

      {/* ---- Add Extra Charge Modal ---- */}
      <Modal
        open={extraChargeModalOpen}
        onClose={() => {
          setExtraChargeModalOpen(false);
          setExtraChargeError(null);
        }}
        title="Add Extra Charge"
        description={detailBooking ? `${detailBooking.booking_ref_no} · ${detailBooking.unit.unit_number}` : undefined}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addExtraChargeToBooking.mutate();
          }}
          className="space-y-4"
        >
          {extraChargeError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{extraChargeError}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ec_reason">For</Label>
              <Select
                id="ec_reason"
                value={extraChargeForm.reason}
                onChange={(e) =>
                  setExtraChargeForm({ ...extraChargeForm, reason: e.target.value as ExtraChargesReason })
                }
              >
                {extraChargesReasons.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ec_amount">Amount (PKR)</Label>
              <Input
                id="ec_amount"
                type="number"
                required
                value={extraChargeForm.amount}
                onChange={(e) => setExtraChargeForm({ ...extraChargeForm, amount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ec_narration">Narration (optional)</Label>
            <Input
              id="ec_narration"
              value={extraChargeForm.narration}
              onChange={(e) => setExtraChargeForm({ ...extraChargeForm, narration: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setExtraChargeModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addExtraChargeToBooking.isPending}>
              Add Charge
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
          ).toLocaleString()}. Thank you — Hamdan Builders and Developers.`}
          relatedType="Booking"
          relatedId={detailBooking.id}
        />
      )}
    </div>
  );
}
