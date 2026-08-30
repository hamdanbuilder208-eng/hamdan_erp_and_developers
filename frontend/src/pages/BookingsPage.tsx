import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, MessageCircle, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { BookingStatusBadge } from "../components/ui/Badge";
import { SendMessageModal } from "../components/communication/SendMessageModal";
import type {
  Allottee,
  Booking,
  BookingAgent,
  BookingStatus,
  Project,
  ScheduleFrequency,
  Unit,
} from "../types";

const statuses: BookingStatus[] = ["Booked", "Confirmed", "Possession Given", "Cancelled"];
const frequencies: ScheduleFrequency[] = ["Monthly", "Quarterly", "Half-Yearly", "Yearly"];

const emptyForm = {
  project_id: "",
  unit_id: "",
  allottee_id: "",
  discount: "",
  down_payment_amount: "",
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
    queryKey: ["units", "available", form.project_id],
    queryFn: async () =>
      (
        await api.get<Unit[]>("/units/", {
          params: { project_id: Number(form.project_id), status_filter: "Available" },
        })
      ).data,
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

  const selectedUnit = units?.find((u) => u.id === Number(form.unit_id));
  const previewTotal = selectedUnit ? Number(selectedUnit.total_price) - (Number(form.discount) || 0) : 0;
  const previewDownPayment = Number(form.down_payment_amount) || 0;
  const previewInstallmentCount = Number(form.no_of_installments) || 0;
  const previewRemaining = Math.max(previewTotal - previewDownPayment, 0);
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
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(message ?? "Failed to delete booking.");
    },
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
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
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
              <Label htmlFor="b_unit">Unit (Available only)</Label>
              <Select
                id="b_unit"
                required
                value={form.unit_id}
                onChange={(e) => setForm({ ...form, unit_id: e.target.value })}
                disabled={!form.project_id}
              >
                <option value="">Select unit</option>
                {units?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number} · PKR {Number(u.total_price).toLocaleString()}
                  </option>
                ))}
              </Select>
              {form.project_id && units?.length === 0 && (
                <p className="mt-1 text-xs text-warning-700">No available units in this project.</p>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {detailBooking.schedule_lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2 text-navy-800 dark:text-slate-200">{line.label}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{line.due_date}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-navy-900 dark:text-slate-100">
                          {Number(line.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 dark:border-navy-800 pt-4">
              <div className="flex gap-2">
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
                    onClick={() => {
                      if (window.confirm("Cancel this booking? The unit will become Available again.")) {
                        updateStatus.mutate({ id: detailBooking.id, status: "Cancelled" });
                      }
                    }}
                  >
                    Cancel Booking
                  </Button>
                )}
                {detailBooking.allottee.mobile && (
                  <Button size="sm" variant="secondary" onClick={() => setMessageOpen(true)}>
                    <MessageCircle className="h-3.5 w-3.5" />
                    Send WhatsApp / SMS
                  </Button>
                )}
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Permanently delete this booking?")) {
                    deleteBooking.mutate(detailBooking.id);
                  }
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
