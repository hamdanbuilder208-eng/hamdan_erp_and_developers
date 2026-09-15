import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, MessageCircle, Plus, Printer, Trash2, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge } from "../components/ui/Badge";
import { SendMessageModal } from "../components/communication/SendMessageModal";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type { Account, Refund, RefundStatus, RefundType } from "../types";

// Customer refunds are tracked automatically when a booking with payments
// already made is cancelled (see BookingsPage) — this form is only for
// manually recording a Vendor or Employee refund.
const manualRefundTypes: RefundType[] = ["Vendor", "Employee"];
const filterRefundTypes: RefundType[] = ["Customer", "Vendor", "Employee"];

const refundTypeTone: Record<RefundType, "success" | "warning" | "info"> = {
  Customer: "info",
  Vendor: "success",
  Employee: "warning",
};

const statusTone: Record<RefundStatus, "success" | "warning" | "neutral"> = {
  Paid: "success",
  "Partially Paid": "warning",
  Pending: "neutral",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  refund_type: "Vendor" as RefundType,
  party_name: "",
  gross_amount: "",
  deduction_percent: "",
  narration: "",
};

const emptyDeductionForm = { deduction_percent: "" };
const emptyPaymentForm = { payment_date: "", amount: "", account_id: "", cash_account_id: "", narration: "" };

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

  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });

  const cashAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];
  const glAccounts =
    accounts?.filter(
      (a) => (a.nature === "Revenue" || a.nature === "Liability" || a.nature === "Expense") && !a.is_control,
    ) ?? [];

  const grossAmount = Number(form.gross_amount) || 0;
  const deductionPercent = Number(form.deduction_percent) || 0;
  const deductionAmount = Math.round(((grossAmount * deductionPercent) / 100) * 100) / 100;
  const netAmount = grossAmount - deductionAmount;

  const resetForm = () => {
    setForm(emptyForm);
    setFormError(null);
  };

  const createRefund = useMutation({
    mutationFn: async () =>
      (
        await api.post<Refund>("/refunds/", {
          refund_date: todayIso(),
          refund_type: form.refund_type,
          booking_id: null,
          party_name: form.party_name,
          gross_amount: grossAmount,
          deduction_percent: form.deduction_percent ? deductionPercent : null,
          deduction_amount: deductionAmount,
          narration: form.narration || null,
        })
      ).data,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      setModalOpen(false);
      resetForm();
      setPaymentsRefundId(created.id);
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
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete refund."));
    },
  });

  // ---- Manage Payments (installments) ----
  const [paymentsRefundId, setPaymentsRefundId] = React.useState<number | null>(null);
  const paymentsRefund = refunds?.find((r) => r.id === paymentsRefundId) ?? null;

  const [deductionForm, setDeductionForm] = React.useState(emptyDeductionForm);
  React.useEffect(() => {
    if (paymentsRefund) {
      setDeductionForm({
        deduction_percent: paymentsRefund.deduction_percent != null ? String(paymentsRefund.deduction_percent) : "",
      });
    }
  }, [paymentsRefund?.id]);

  const paidSoFar = paymentsRefund?.payments.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const remaining = paymentsRefund ? Number(paymentsRefund.net_amount) - paidSoFar : 0;

  const updateDeduction = useMutation({
    mutationFn: async () => {
      const percent = Number(deductionForm.deduction_percent) || 0;
      const amount = Math.round(((Number(paymentsRefund!.gross_amount) * percent) / 100) * 100) / 100;
      return (
        await api.put<Refund>(`/refunds/${paymentsRefund!.id}/deduction`, {
          deduction_percent: deductionForm.deduction_percent ? percent : null,
          deduction_amount: amount,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      toast.success("Deduction updated.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update deduction.")),
  });

  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [paymentForm, setPaymentForm] = React.useState(emptyPaymentForm);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);

  const addPayment = useMutation({
    mutationFn: async () =>
      (
        await api.post<Refund>(`/refunds/${paymentsRefund!.id}/payments`, {
          payment_date: paymentForm.payment_date || todayIso(),
          amount: Number(paymentForm.amount) || 0,
          account_id: Number(paymentForm.account_id),
          cash_account_id: Number(paymentForm.cash_account_id),
          narration: paymentForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      setPaymentModalOpen(false);
      setPaymentForm(emptyPaymentForm);
      setPaymentError(null);
      toast.success("Payment recorded.");
    },
    onError: (err: unknown) => setPaymentError(apiErrorMessage(err, "Failed to record payment.")),
  });

  const deletePayment = useMutation({
    mutationFn: async (paymentId: number) => api.delete(`/refunds/payments/${paymentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["refunds"] }),
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete payment.")),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Refunds</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Customer (sales) refunds, vendor/supplier refunds, and employee reimbursements — payable in
            one go or in installments.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Refund
        </Button>
      </div>

      <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-48">
        <option value="">All Types</option>
        {filterRefundTypes.map((t) => (
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
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Net Amount</th>
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
            {!isLoading && refunds?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
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
                <td className="px-5 py-3">
                  <Badge tone={statusTone[r.status]}>
                    {r.status === "Paid" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {r.status}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-right font-medium text-navy-900 dark:text-slate-100">
                  PKR {Number(r.net_amount).toLocaleString()}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {r.status === "Paid" ? (
                      <button
                        onClick={() => setPaymentsRefundId(r.id)}
                        title="View payments"
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <Button size="sm" onClick={() => setPaymentsRefundId(r.id)}>
                        <Wallet className="h-3.5 w-3.5" />
                        Pay
                      </Button>
                    )}
                    {r.status === "Paid" && r.refund_type === "Customer" && r.booking?.allottee.mobile && (
                      <button
                        onClick={() => setMessageRefund(r)}
                        title="Send WhatsApp / SMS"
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {r.status !== "Pending" && (
                      <button
                        onClick={() => window.open(`/refunds/${r.id}/print`, "_blank")}
                        title="Print / Download PDF"
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                    )}
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
        description="Add payments (one or several installments) once it's created."
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
            {manualRefundTypes.map((t) => (
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
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Customer refunds are tracked automatically when a booking with payments is cancelled — see
            the Booking Cancel action.
          </p>

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
            <div>
              <Label htmlFor="rf_deduction">Deduction % (optional)</Label>
              <Input
                id="rf_deduction"
                type="number"
                step="0.01"
                value={form.deduction_percent}
                onChange={(e) => setForm({ ...form, deduction_percent: e.target.value })}
              />
            </div>
          </div>

          {grossAmount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
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
              Save Refund
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Manage Payments Modal ---- */}
      <Modal
        open={!!paymentsRefund}
        onClose={() => setPaymentsRefundId(null)}
        title={paymentsRefund ? `Payments — ${paymentsRefund.refund_no}` : ""}
        description={
          paymentsRefund
            ? paymentsRefund.party_name ?? paymentsRefund.booking?.allottee.name ?? undefined
            : undefined
        }
      >
        {paymentsRefund && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Gross Amount</p>
                <p className="font-medium text-navy-900 dark:text-slate-100">
                  PKR {Number(paymentsRefund.gross_amount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Paid</p>
                <p className="font-medium text-success-700">PKR {paidSoFar.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Remaining</p>
                <p className="font-medium text-danger-600">PKR {remaining.toLocaleString()}</p>
              </div>
            </div>

            {paymentsRefund.status === "Pending" && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label htmlFor="deduction_percent">Deduction % (cancellation charges)</Label>
                  <Input
                    id="deduction_percent"
                    type="number"
                    step="0.01"
                    value={deductionForm.deduction_percent}
                    onChange={(e) => setDeductionForm({ deduction_percent: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={updateDeduction.isPending}
                  onClick={() => updateDeduction.mutate()}
                >
                  Update
                </Button>
              </div>
            )}

            {remaining > 0 && (
              <Button
                size="sm"
                onClick={() => {
                  setPaymentForm({ ...emptyPaymentForm, amount: String(remaining) });
                  setPaymentError(null);
                  setPaymentModalOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Record Payment
              </Button>
            )}

            {paymentsRefund.payments.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Payment History
                </p>
                <div className="space-y-1.5">
                  {paymentsRefund.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-navy-800"
                    >
                      <span className="text-navy-900 dark:text-slate-100">
                        {p.payment_date} · PKR {Number(p.amount).toLocaleString()} · {p.cash_account.name}
                      </span>
                      <button
                        onClick={async () => {
                          const ok = await confirm("Delete this payment?", { danger: true, confirmLabel: "Delete" });
                          if (ok) deletePayment.mutate(p.id);
                        }}
                        className="rounded-md p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---- Record Payment Modal ---- */}
      <Modal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setPaymentError(null);
        }}
        title="Record Refund Payment"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addPayment.mutate();
          }}
          className="space-y-4"
        >
          {paymentError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{paymentError}</p>
          )}
          <div>
            <Label htmlFor="payment_amount">Amount (PKR)</Label>
            <Input
              id="payment_amount"
              type="number"
              required
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="payment_date">Date</Label>
            <Input
              id="payment_date"
              type="date"
              required
              value={paymentForm.payment_date || todayIso()}
              onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="payment_account">
                {paymentsRefund?.refund_type === "Vendor" ? "Vendor / Payable Account" : "Revenue / Expense Account"}
              </Label>
              <Select
                id="payment_account"
                required
                value={paymentForm.account_id}
                onChange={(e) => setPaymentForm({ ...paymentForm, account_id: e.target.value })}
              >
                <option value="">Select account</option>
                {glAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="payment_cash">
                {paymentsRefund?.refund_type === "Vendor" ? "Received Into" : "Paid From"}
              </Label>
              <Select
                id="payment_cash"
                required
                value={paymentForm.cash_account_id}
                onChange={(e) => setPaymentForm({ ...paymentForm, cash_account_id: e.target.value })}
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={addPayment.isPending}>
              Record
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
          ).toLocaleString()} for booking ${messageRefund.booking.booking_ref_no} has been processed. Thank you — Hamdan Builders and Developers.`}
          relatedType="Refund"
          relatedId={messageRefund.id}
        />
      )}
    </div>
  );
}
