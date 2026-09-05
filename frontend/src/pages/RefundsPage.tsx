import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Plus, Printer, Trash2, Undo2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { SendMessageModal } from "../components/communication/SendMessageModal";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type { Account, Booking, Refund, RefundType } from "../types";

const refundTypes: RefundType[] = ["Customer", "Vendor", "Employee"];

const refundTypeTone: Record<RefundType, "success" | "warning" | "info"> = {
  Customer: "info",
  Vendor: "success",
  Employee: "warning",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  refund_type: "Customer" as RefundType,
  booking_id: "",
  party_name: "",
  account_id: "",
  cash_account_id: "",
  gross_amount: "",
  deduction_percent: "",
  narration: "",
};

export default function RefundsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [filterType, setFilterType] = React.useState("");
  const [form, setForm] = React.useState(emptyForm);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [messageRefund, setMessageRefund] = React.useState<Refund | null>(null);

  const { data: refunds, isLoading } = useQuery({
    queryKey: ["refunds", filterType],
    queryFn: async () =>
      (await api.get<Refund[]>("/refunds/", { params: { refund_type: filterType || undefined } })).data,
  });

  const { data: bookings } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => (await api.get<Booking[]>("/bookings/")).data,
  });

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const cashAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];
  const revenueAccounts = accounts?.filter((a) => a.nature === "Revenue" && !a.is_control) ?? [];
  const liabilityAccounts = accounts?.filter((a) => a.nature === "Liability" && !a.is_control) ?? [];
  const expenseAccounts = accounts?.filter((a) => a.nature === "Expense" && !a.is_control) ?? [];

  const refundableBookings = bookings?.filter((b) => b.status !== "Cancelled") ?? [];
  const selectedBooking = refundableBookings.find((b) => b.id === Number(form.booking_id));
  const paidToDate = selectedBooking
    ? selectedBooking.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0)
    : 0;

  const grossAmount = Number(form.gross_amount) || 0;
  const deductionPercent = Number(form.deduction_percent) || 0;
  const deductionAmount = Math.round(((grossAmount * deductionPercent) / 100) * 100) / 100;
  const netAmount = grossAmount - deductionAmount;

  const resetForm = () => {
    setForm(emptyForm);
    setFormError(null);
  };

  const selectBooking = (bookingId: string) => {
    const booking = refundableBookings.find((b) => b.id === Number(bookingId));
    const paid = booking ? booking.schedule_lines.reduce((s, l) => s + Number(l.paid_amount), 0) : 0;
    setForm((f) => ({ ...f, booking_id: bookingId, gross_amount: paid ? String(paid) : "" }));
  };

  const createRefund = useMutation({
    mutationFn: async () =>
      (
        await api.post<Refund>("/refunds/", {
          refund_date: todayIso(),
          refund_type: form.refund_type,
          booking_id: form.refund_type === "Customer" ? Number(form.booking_id) : null,
          party_name: form.refund_type !== "Customer" ? form.party_name : null,
          account_id: Number(form.account_id),
          cash_account_id: Number(form.cash_account_id),
          gross_amount: grossAmount,
          deduction_percent: form.deduction_percent ? deductionPercent : null,
          deduction_amount: deductionAmount,
          narration: form.narration || null,
        })
      ).data,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      window.open(`/refunds/${created.id}/print`, "_blank");
      setModalOpen(false);
      resetForm();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string | { msg: string }[] } } })?.response
        ?.data?.detail;
      setFormError(
        Array.isArray(message) ? message.map((m) => m.msg).join(", ") : (message as string) ?? "Failed to save refund",
      );
    },
  });

  const deleteRefund = useMutation({
    mutationFn: async (id: number) => api.delete(`/refunds/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete refund."));
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Refunds</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Customer (sales) refunds, vendor/supplier refunds, and employee reimbursements.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Refund
        </Button>
      </div>

      <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-48">
        <option value="">All Types</option>
        {refundTypes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Refund #</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Party / Booking</th>
              <th className="px-5 py-3 text-right font-medium">Net Amount</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && refunds?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No refunds yet. Click "New Refund" to record one.
                </td>
              </tr>
            )}
            {refunds?.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{r.refund_no}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{r.refund_date}</td>
                <td className="px-5 py-3">
                  <Badge tone={refundTypeTone[r.refund_type]}>{r.refund_type}</Badge>
                </td>
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                  {r.booking
                    ? `${r.booking.booking_ref_no} · ${r.booking.allottee.name}`
                    : r.party_name || "—"}
                </td>
                <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                  PKR {Number(r.net_amount).toLocaleString()}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {r.refund_type === "Customer" && r.booking?.allottee.mobile && (
                      <button
                        onClick={() => setMessageRefund(r)}
                        title="Send WhatsApp / SMS"
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => window.open(`/refunds/${r.id}/print`, "_blank")}
                      title="Print / Download PDF"
                      className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await confirm(`Delete refund "${r.refund_no}"? This cannot be undone.`, {
                          danger: true,
                          confirmLabel: "Delete",
                        });
                        if (ok) deleteRefund.mutate(r.id);
                      }}
                      title="Delete refund"
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
        title="New Refund"
        description="Refunds post a reversing accounting entry automatically."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            createRefund.mutate();
          }}
          className="space-y-4"
        >
          <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-navy-700">
            {refundTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setForm({ ...emptyForm, refund_type: t })
                }
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  form.refund_type === t
                    ? "bg-brand-600 text-white"
                    : "bg-white dark:bg-navy-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/60"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {form.refund_type === "Customer" ? (
            <div>
              <Label htmlFor="rf_booking">Booking</Label>
              <Select
                id="rf_booking"
                required
                value={form.booking_id}
                onChange={(e) => selectBooking(e.target.value)}
              >
                <option value="">Select booking</option>
                {refundableBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.booking_ref_no} · {b.unit.unit_number} · {b.allottee.name}
                  </option>
                ))}
              </Select>
              {selectedBooking && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Paid to date: PKR {paidToDate.toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div>
              <Label htmlFor="rf_party">{form.refund_type === "Vendor" ? "Vendor Name" : "Employee Name"}</Label>
              <Input
                id="rf_party"
                required
                value={form.party_name}
                onChange={(e) => setForm({ ...form, party_name: e.target.value })}
                placeholder={form.refund_type === "Vendor" ? "e.g. ABC Cement Suppliers" : "e.g. Asif — Site Supervisor"}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rf_account">
                {form.refund_type === "Customer"
                  ? "Revenue Account"
                  : form.refund_type === "Vendor"
                    ? "Vendor / Payable Account"
                    : "Expense Account"}
              </Label>
              <Select
                id="rf_account"
                required
                value={form.account_id}
                onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              >
                <option value="">Select account</option>
                {(form.refund_type === "Customer"
                  ? revenueAccounts
                  : form.refund_type === "Vendor"
                    ? liabilityAccounts
                    : expenseAccounts
                ).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="rf_cash">{form.refund_type === "Vendor" ? "Received Into" : "Paid From"}</Label>
              <Select
                id="rf_cash"
                required
                value={form.cash_account_id}
                onChange={(e) => setForm({ ...form, cash_account_id: e.target.value })}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rf_gross">Gross Amount</Label>
              <Input
                id="rf_gross"
                type="number"
                required
                value={form.gross_amount}
                onChange={(e) => setForm({ ...form, gross_amount: e.target.value })}
              />
            </div>
            {form.refund_type === "Customer" && (
              <div>
                <Label htmlFor="rf_deduction">Deduction % (cancellation charges)</Label>
                <Input
                  id="rf_deduction"
                  type="number"
                  step="0.01"
                  value={form.deduction_percent}
                  onChange={(e) => setForm({ ...form, deduction_percent: e.target.value })}
                />
              </div>
            )}
          </div>

          {grossAmount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
              <Undo2 className="h-4 w-4" />
              Net Refundable: <span className="font-semibold">PKR {netAmount.toLocaleString()}</span>
              {deductionAmount > 0 && (
                <span className="text-brand-500">
                  (Gross {grossAmount.toLocaleString()} − Deduction {deductionAmount.toLocaleString()})
                </span>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="rf_narration">Narration</Label>
            <Input
              id="rf_narration"
              value={form.narration}
              onChange={(e) => setForm({ ...form, narration: e.target.value })}
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{formError}</p>
          )}

          {form.refund_type === "Customer" && (
            <p className="text-xs text-warning-700">
              Submitting will cancel this booking and free up the unit.
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
            <Button type="submit" disabled={createRefund.isPending || netAmount <= 0}>
              Process Refund
            </Button>
          </div>
        </form>
      </Modal>

      {messageRefund && messageRefund.booking && (
        <SendMessageModal
          open={!!messageRefund}
          onClose={() => setMessageRefund(null)}
          defaultPhone={messageRefund.booking.allottee.mobile ?? ""}
          defaultName={messageRefund.booking.allottee.name}
          defaultMessage={`Dear ${messageRefund.booking.allottee.name}, your refund of PKR ${Number(
            messageRefund.net_amount,
          ).toLocaleString()} for booking ${messageRefund.booking.booking_ref_no} has been processed. Thank you — Hamdan Associates.`}
          relatedType="Refund"
          relatedId={messageRefund.id}
        />
      )}
    </div>
  );
}
