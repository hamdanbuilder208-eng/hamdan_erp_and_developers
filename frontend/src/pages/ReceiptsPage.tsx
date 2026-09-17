import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Receipt as ReceiptIcon,
  Trash2,
  XCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { SendMessageModal } from "../components/communication/SendMessageModal";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import { useAuthStore } from "../store/authStore";
import type { Account, Booking, Project, Receipt, ReceiptPaymentType } from "../types";

const paymentTypes: ReceiptPaymentType[] = [
  "Booking",
  "Installment",
  "Extra Charges",
  "Documentation Charges",
];
const paymentModes = ["Cash", "Cheque", "Bank Transfer", "Online"];

const todayIso = () => new Date().toISOString().slice(0, 10);

const makeEmptyForm = () => ({
  receipt_date: todayIso(),
  booking_id: "",
  amount: "",
  payment_type: "Installment" as ReceiptPaymentType,
  mode_of_payment: "Cash",
  cheque_no: "",
  cheque_date: "",
  cheque_clearing_date: "",
  credit_account_id: "",
  narration: "",
  schedule_line_id: "",
});

function bookingSummary(booking: Booking) {
  const paid = booking.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0);
  const outstanding = Number(booking.total_price) - paid;
  const nextDue = booking.schedule_lines
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .find((l) => Number(l.paid_amount) < Number(l.amount));
  return { paid, outstanding, nextDue };
}

export default function ReceiptsPage() {
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role.is_admin) ?? false;
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingReceiptId, setEditingReceiptId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState(makeEmptyForm);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [messageReceipt, setMessageReceipt] = React.useState<Receipt | null>(null);
  const [filterProjectId, setFilterProjectId] = React.useState("");

  const { data: receipts, isLoading } = useQuery({
    queryKey: ["receipts", filterProjectId],
    queryFn: async () =>
      (
        await api.get<Receipt[]>("/receipts/", {
          params: { project_id: filterProjectId || undefined },
        })
      ).data,
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => (await api.get<Booking[]>("/bookings/")).data,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const cashBankAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];
  const bookableBookings = bookings?.filter((b) => b.status !== "Cancelled") ?? [];
  const selectedBooking = bookableBookings.find((b) => b.id === Number(form.booking_id));
  const summary = selectedBooking ? bookingSummary(selectedBooking) : null;
  const unpaidLines = selectedBooking
    ? selectedBooking.schedule_lines
        .filter((l) => Number(l.paid_amount) < Number(l.amount))
        .slice()
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
    : [];

  const resetForm = () => {
    setForm(makeEmptyForm());
    setFormError(null);
    setEditingReceiptId(null);
  };

  const startEdit = (r: Receipt) => {
    setForm({
      receipt_date: r.receipt_date,
      booking_id: String(r.booking_id),
      amount: String(r.amount),
      payment_type: r.payment_type,
      mode_of_payment: r.mode_of_payment,
      cheque_no: r.cheque_no ?? "",
      cheque_date: r.cheque_date ?? "",
      cheque_clearing_date: r.cheque_clearing_date ?? "",
      credit_account_id: String(r.credit_account_id),
      narration: r.narration ?? "",
      schedule_line_id: "",
    });
    setFormError(null);
    setEditingReceiptId(r.id);
    setModalOpen(true);
  };

  const selectBooking = (bookingId: string) => {
    const booking = bookableBookings.find((b) => b.id === Number(bookingId));
    const suggested = booking ? bookingSummary(booking).nextDue : undefined;
    setForm({
      ...makeEmptyForm(),
      receipt_date: form.receipt_date,
      booking_id: bookingId,
      amount: suggested ? String(Number(suggested.amount) - Number(suggested.paid_amount)) : "",
      payment_type: suggested?.installment_no === 0 ? "Booking" : "Installment",
    });
  };

  const createReceipt = useMutation({
    mutationFn: async () =>
      (
        await api.post<Receipt>("/receipts/", {
          receipt_date: isAdmin ? form.receipt_date : todayIso(),
          booking_id: Number(form.booking_id),
          credit_account_id: Number(form.credit_account_id),
          amount: Number(form.amount),
          payment_type: form.payment_type,
          mode_of_payment: form.mode_of_payment,
          cheque_no: form.mode_of_payment === "Cheque" ? form.cheque_no || null : null,
          cheque_date: form.mode_of_payment === "Cheque" ? form.cheque_date || null : null,
          cheque_clearing_date:
            form.mode_of_payment === "Cheque" ? form.cheque_clearing_date || null : null,
          narration: form.narration || null,
          schedule_line_id: form.schedule_line_id ? Number(form.schedule_line_id) : null,
        })
      ).data,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      setModalOpen(false);
      resetForm();
      window.open(`/receipts/${created.id}/print`, "_blank");
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(message ?? "Failed to save receipt");
    },
  });

  const updateReceipt = useMutation({
    mutationFn: async () =>
      (
        await api.put<Receipt>(`/receipts/${editingReceiptId}`, {
          receipt_date: form.receipt_date,
          booking_id: Number(form.booking_id),
          credit_account_id: Number(form.credit_account_id),
          amount: Number(form.amount),
          payment_type: form.payment_type,
          mode_of_payment: form.mode_of_payment,
          cheque_no: form.mode_of_payment === "Cheque" ? form.cheque_no || null : null,
          cheque_date: form.mode_of_payment === "Cheque" ? form.cheque_date || null : null,
          cheque_clearing_date:
            form.mode_of_payment === "Cheque" ? form.cheque_clearing_date || null : null,
          narration: form.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-cheques"] });
      setModalOpen(false);
      resetForm();
      toast.success("Receipt updated.");
    },
    onError: (err: unknown) => setFormError(apiErrorMessage(err, "Failed to update receipt")),
  });

  const deleteReceipt = useMutation({
    mutationFn: async (id: number) => api.delete(`/receipts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete receipt."));
    },
  });

  const updateChequeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "Cleared" | "Bounced" }) =>
      (await api.patch<Receipt>(`/receipts/${id}/cheque-status`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["pending-cheques"] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to update cheque status."));
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Receipts</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Record installment payments and print the customer's payment slip.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Receipt
        </Button>
      </div>

      <Select value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)} className="w-56">
        <option value="">All Projects</option>
        {projects?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.project_name}
          </option>
        ))}
      </Select>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Receipt #</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Project</th>
              <th className="px-5 py-3 font-medium">Booking / Unit</th>
              <th className="px-5 py-3 font-medium">Allottee</th>
              <th className="px-5 py-3 font-medium">Mode</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <TableRowsSkeleton rows={4} cols={8} />}
            {!isLoading && receipts?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No receipts yet. Click "New Receipt" to record a payment.
                </td>
              </tr>
            )}
            {receipts?.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{r.receipt_no}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.receipt_date}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.booking.project.project_name}</td>
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                  {r.booking.booking_ref_no} · {r.booking.unit.unit_number}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.booking.allottee.name}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {r.mode_of_payment}
                  {r.mode_of_payment === "Cheque" && r.cheque_status && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {r.cheque_status === "Pending" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                          <Clock className="h-3 w-3" />
                          Pending{r.cheque_clearing_date ? ` · ${r.cheque_clearing_date}` : ""}
                        </span>
                      )}
                      {r.cheque_status === "Cleared" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-medium text-success-700">
                          <CheckCircle2 className="h-3 w-3" />
                          Cleared{r.cheque_clearing_date ? ` · ${r.cheque_clearing_date}` : ""}
                        </span>
                      )}
                      {r.cheque_status === "Bounced" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-medium text-danger-700">
                          <XCircle className="h-3 w-3" />
                          Bounced{r.cheque_clearing_date ? ` · ${r.cheque_clearing_date}` : ""}
                        </span>
                      )}
                      {r.cheque_status === "Pending" && (
                        <div className="flex w-full gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => updateChequeStatus.mutate({ id: r.id, status: "Cleared" })}
                          >
                            Mark Cleared
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={async () => {
                              const ok = await confirm(
                                `Mark cheque ${r.cheque_no ?? ""} as bounced? This will reverse the payment.`,
                                { danger: true, confirmLabel: "Mark Bounced" },
                              );
                              if (ok) updateChequeStatus.mutate({ id: r.id, status: "Bounced" });
                            }}
                          >
                            Mark Bounced
                          </Button>
                        </div>
                      )}
                      {r.cheque_status === "Bounced" && (
                        <div className="flex w-full gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              const ok = await confirm(
                                `Mark cheque ${r.cheque_no ?? ""} as cleared? Use this if it was re-presented and this time went through — the payment will be re-applied.`,
                              );
                              if (ok) updateChequeStatus.mutate({ id: r.id, status: "Cleared" });
                            }}
                          >
                            Mark Cleared (Re-presented)
                          </Button>
                        </div>
                      )}
                      {r.cheque_status === "Cleared" && (
                        <div className="flex w-full gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await confirm(
                                `Mark cheque ${r.cheque_no ?? ""} as bounced? This will reverse the payment.`,
                                { danger: true, confirmLabel: "Mark Bounced" },
                              );
                              if (ok) updateChequeStatus.mutate({ id: r.id, status: "Bounced" });
                            }}
                            className="text-[11px] font-medium text-danger-600 hover:underline"
                          >
                            Marked cleared by mistake? Mark Bounced instead
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                  PKR {Number(r.amount).toLocaleString()}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {r.booking.allottee.mobile && (
                      <button
                        onClick={() => setMessageReceipt(r)}
                        title="Send WhatsApp / SMS"
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => window.open(`/receipts/${r.id}/print`, "_blank")}
                      title="Print / Download Slip"
                      className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => startEdit(r)}
                        title="Edit receipt (admin only)"
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const ok = await confirm(`Delete receipt "${r.receipt_no}"? This cannot be undone.`, {
                          danger: true,
                          confirmLabel: "Delete",
                        });
                        if (ok) deleteReceipt.mutate(r.id);
                      }}
                      title="Delete receipt"
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
        title={editingReceiptId ? "Edit Receipt" : "New Receipt"}
        description={
          editingReceiptId
            ? "Correct a previously recorded receipt — admin only."
            : "Record a payment received against a booking's installment plan."
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            if (editingReceiptId) {
              updateReceipt.mutate();
            } else {
              createReceipt.mutate();
            }
          }}
          className="space-y-4"
        >
          {isAdmin && (
            <div>
              <Label htmlFor="r_receipt_date">Receipt Date</Label>
              <Input
                id="r_receipt_date"
                type="date"
                required
                max={todayIso()}
                value={form.receipt_date}
                onChange={(e) => setForm({ ...form, receipt_date: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Admin only — back-date a receipt if it couldn't be recorded on the day it was received.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="r_booking">Booking</Label>
            <Select
              id="r_booking"
              required
              value={form.booking_id}
              onChange={(e) =>
                editingReceiptId
                  ? setForm({ ...form, booking_id: e.target.value })
                  : selectBooking(e.target.value)
              }
            >
              <option value="">Select booking</option>
              {bookableBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.project.project_name} · {b.booking_ref_no} · {b.unit.unit_number} · {b.allottee.name}
                </option>
              ))}
            </Select>
          </div>

          {selectedBooking && summary && (
            <div className="grid grid-cols-3 gap-3 rounded-lg bg-brand-50 px-4 py-3 text-xs text-brand-800">
              <div>
                <p className="text-brand-500">Total Price</p>
                <p className="font-semibold">PKR {Number(selectedBooking.total_price).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-brand-500">Paid to Date</p>
                <p className="font-semibold">PKR {summary.paid.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-brand-500">Outstanding</p>
                <p className="font-semibold">PKR {summary.outstanding.toLocaleString()}</p>
              </div>
              {summary.nextDue && (
                <div className="col-span-3 border-t border-brand-100 pt-2">
                  Next due: <span className="font-semibold">{summary.nextDue.label}</span> on{" "}
                  {summary.nextDue.due_date} — PKR{" "}
                  {(Number(summary.nextDue.amount) - Number(summary.nextDue.paid_amount)).toLocaleString()}{" "}
                  ·{" "}
                  <button
                    type="button"
                    onClick={() => {
                      const nextDue = summary.nextDue!;
                      setForm({
                        ...form,
                        amount: String(Number(nextDue.amount) - Number(nextDue.paid_amount)),
                        payment_type: nextDue.installment_no === 0 ? "Booking" : "Installment",
                        schedule_line_id: "",
                      });
                    }}
                    className="font-semibold underline hover:text-brand-600"
                  >
                    Normal Payment
                  </button>
                </div>
              )}
              {summary.outstanding > 0 && (
                <div className="col-span-3 border-t border-brand-100 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        amount: String(summary.outstanding),
                        payment_type: "Installment",
                        schedule_line_id: "",
                      })
                    }
                    className="font-semibold underline hover:text-brand-600"
                  >
                    Pay full outstanding (PKR {summary.outstanding.toLocaleString()})
                  </button>{" "}
                  — for a client settling everything early instead of installment by installment.
                </div>
              )}
            </div>
          )}

          {selectedBooking && !editingReceiptId && unpaidLines.length > 0 && (
            <div>
              <Label htmlFor="r_target_line">Custom Payment — Target Installment</Label>
              <Select
                id="r_target_line"
                value={form.schedule_line_id}
                onChange={(e) => {
                  const lineId = e.target.value;
                  const line = unpaidLines.find((l) => l.id === Number(lineId));
                  setForm({
                    ...form,
                    schedule_line_id: lineId,
                    amount: line ? String(Number(line.amount) - Number(line.paid_amount)) : form.amount,
                    payment_type: line
                      ? line.installment_no === 0
                        ? "Booking"
                        : "Installment"
                      : form.payment_type,
                  });
                }}
              >
                <option value="">— Auto (oldest due first) —</option>
                {unpaidLines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} — due {l.due_date} — balance PKR{" "}
                    {(Number(l.amount) - Number(l.paid_amount)).toLocaleString()}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Pick a specific installment to settle it first (e.g. the 2nd installment even if
                the 1st isn't fully paid yet) — leave on Auto to keep paying oldest-due-first.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="r_amount">Amount</Label>
              <Input
                id="r_amount"
                type="number"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="r_type">Payment Type</Label>
              <Select
                id="r_type"
                value={form.payment_type}
                onChange={(e) => setForm({ ...form, payment_type: e.target.value as ReceiptPaymentType })}
              >
                {paymentTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="r_mode">Mode of Payment</Label>
              <Select
                id="r_mode"
                value={form.mode_of_payment}
                onChange={(e) => setForm({ ...form, mode_of_payment: e.target.value })}
              >
                {paymentModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="r_account">Received Into</Label>
              <Select
                id="r_account"
                required
                value={form.credit_account_id}
                onChange={(e) => setForm({ ...form, credit_account_id: e.target.value })}
              >
                <option value="">Select account</option>
                {cashBankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {form.mode_of_payment === "Cheque" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="r_cheque_no">Cheque No.</Label>
                <Input
                  id="r_cheque_no"
                  value={form.cheque_no}
                  onChange={(e) => setForm({ ...form, cheque_no: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="r_cheque_date">Cheque Date</Label>
                <Input
                  id="r_cheque_date"
                  type="date"
                  value={form.cheque_date}
                  onChange={(e) => setForm({ ...form, cheque_date: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="r_cheque_clearing_date">Cash Date</Label>
                <Input
                  id="r_cheque_clearing_date"
                  type="date"
                  value={form.cheque_clearing_date}
                  onChange={(e) => setForm({ ...form, cheque_clearing_date: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  When this cheque is due to be presented at the bank — you'll get a dashboard
                  reminder on this date to confirm it cleared or bounced.
                </p>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="r_narration">Narration</Label>
            <Input
              id="r_narration"
              value={form.narration}
              onChange={(e) => setForm({ ...form, narration: e.target.value })}
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{formError}</p>
          )}

          {!editingReceiptId && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <ReceiptIcon className="h-3.5 w-3.5" />
              The installment slip will open automatically after saving.
            </p>
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
            <Button type="submit" disabled={createReceipt.isPending || updateReceipt.isPending}>
              {editingReceiptId ? "Save Changes" : "Save Receipt"}
            </Button>
          </div>
        </form>
      </Modal>

      {messageReceipt && (
        <SendMessageModal
          open={!!messageReceipt}
          onClose={() => setMessageReceipt(null)}
          defaultPhone={messageReceipt.booking.allottee.mobile ?? ""}
          defaultName={messageReceipt.booking.allottee.name}
          defaultMessage={`Dear ${messageReceipt.booking.allottee.name}, we've received your payment of PKR ${Number(
            messageReceipt.amount,
          ).toLocaleString()} for booking ${messageReceipt.booking.booking_ref_no}. Thank you — Hamdan Builders and Developers.`}
          relatedType="Receipt"
          relatedId={messageReceipt.id}
        />
      )}
    </div>
  );
}
