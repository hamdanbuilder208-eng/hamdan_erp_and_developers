import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus, Printer, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { SendMessageModal } from "../components/communication/SendMessageModal";
import type { Account, Booking, Receipt, ReceiptPaymentType } from "../types";

const paymentTypes: ReceiptPaymentType[] = [
  "Booking",
  "Installment",
  "Extra Charges",
  "Documentation Charges",
];
const paymentModes = ["Cash", "Cheque", "Bank Transfer", "Online"];

const emptyForm = {
  booking_id: "",
  amount: "",
  payment_type: "Installment" as ReceiptPaymentType,
  mode_of_payment: "Cash",
  cheque_no: "",
  cheque_date: "",
  credit_account_id: "",
  narration: "",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function bookingSummary(booking: Booking) {
  const paid = booking.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0);
  const outstanding = Number(booking.total_price) - paid;
  const nextDue = booking.schedule_lines
    .slice()
    .sort((a, b) => a.installment_no - b.installment_no)
    .find((l) => Number(l.paid_amount) < Number(l.amount));
  return { paid, outstanding, nextDue };
}

export default function ReceiptsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [messageReceipt, setMessageReceipt] = React.useState<Receipt | null>(null);

  const { data: receipts, isLoading } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => (await api.get<Receipt[]>("/receipts/")).data,
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => (await api.get<Booking[]>("/bookings/")).data,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const cashBankAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];
  const bookableBookings = bookings?.filter((b) => b.status !== "Cancelled") ?? [];
  const selectedBooking = bookableBookings.find((b) => b.id === Number(form.booking_id));
  const summary = selectedBooking ? bookingSummary(selectedBooking) : null;

  const resetForm = () => {
    setForm(emptyForm);
    setFormError(null);
  };

  const selectBooking = (bookingId: string) => {
    const booking = bookableBookings.find((b) => b.id === Number(bookingId));
    const suggested = booking ? bookingSummary(booking).nextDue : undefined;
    setForm({
      ...emptyForm,
      booking_id: bookingId,
      amount: suggested ? String(Number(suggested.amount) - Number(suggested.paid_amount)) : "",
      payment_type: suggested?.installment_no === 0 ? "Booking" : "Installment",
    });
  };

  const createReceipt = useMutation({
    mutationFn: async () =>
      (
        await api.post<Receipt>("/receipts/", {
          receipt_date: todayIso(),
          booking_id: Number(form.booking_id),
          credit_account_id: Number(form.credit_account_id),
          amount: Number(form.amount),
          payment_type: form.payment_type,
          mode_of_payment: form.mode_of_payment,
          cheque_no: form.mode_of_payment === "Cheque" ? form.cheque_no || null : null,
          cheque_date: form.mode_of_payment === "Cheque" ? form.cheque_date || null : null,
          narration: form.narration || null,
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

  const deleteReceipt = useMutation({
    mutationFn: async (id: number) => api.delete(`/receipts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(message ?? "Failed to delete receipt.");
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

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Receipt #</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Booking / Unit</th>
              <th className="px-5 py-3 font-medium">Allottee</th>
              <th className="px-5 py-3 font-medium">Mode</th>
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
            {!isLoading && receipts?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No receipts yet. Click "New Receipt" to record a payment.
                </td>
              </tr>
            )}
            {receipts?.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{r.receipt_no}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.receipt_date}</td>
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                  {r.booking.booking_ref_no} · {r.booking.unit.unit_number}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.booking.allottee.name}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.mode_of_payment}</td>
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
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete receipt "${r.receipt_no}"? This cannot be undone.`)) {
                          deleteReceipt.mutate(r.id);
                        }
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
        title="New Receipt"
        description="Record a payment received against a booking's installment plan."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            createReceipt.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="r_booking">Booking</Label>
            <Select
              id="r_booking"
              required
              value={form.booking_id}
              onChange={(e) => selectBooking(e.target.value)}
            >
              <option value="">Select booking</option>
              {bookableBookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.booking_ref_no} · {b.unit.unit_number} · {b.allottee.name}
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
                  {(Number(summary.nextDue.amount) - Number(summary.nextDue.paid_amount)).toLocaleString()}
                </div>
              )}
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

          <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <ReceiptIcon className="h-3.5 w-3.5" />
            The installment slip will open automatically after saving.
          </p>

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
            <Button type="submit" disabled={createReceipt.isPending}>
              Save Receipt
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
          ).toLocaleString()} for booking ${messageReceipt.booking.booking_ref_no}. Thank you — Hamdan Associates.`}
          relatedType="Receipt"
          relatedId={messageReceipt.id}
        />
      )}
    </div>
  );
}
