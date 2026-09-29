import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type {
  LandProperty,
  LandPropertyPaymentDirection,
  LandPropertyStatus,
  PaymentMode,
  PropertyType,
  SizeUnit,
} from "../types";

const propertyTypes: PropertyType[] = ["Plot", "Land", "Commercial Shop", "SR", "Other"];
const sizeUnits: SizeUnit[] = ["Sq. Yd.", "Sq. Ft.", "Marla", "Kanal"];
const statuses: LandPropertyStatus[] = ["Available", "Reserved", "Sold"];
const paymentModes: PaymentMode[] = ["Cash", "Cheque", "Bank Transfer", "Online"];

const emptyPaymentForm = { amount: "", payment_date: "", mode_of_payment: "Cash" as PaymentMode, narration: "" };
const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  property_type: "Plot" as PropertyType,
  area_location: "",
  size_number: "",
  size_unit: "Sq. Yd." as SizeUnit,
  owner_vendor: "",
  purchase_rate: "",
  sale_rate: "",
  remarks: "",
};

export default function LandPlotsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [filterType, setFilterType] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("");
  const [form, setForm] = React.useState(emptyForm);

  const { data: properties, isLoading } = useQuery({
    queryKey: ["land-properties", filterType, filterStatus],
    queryFn: async () =>
      (
        await api.get<LandProperty[]>("/land-properties/", {
          params: {
            property_type: filterType || undefined,
            status_filter: filterStatus || undefined,
          },
        })
      ).data,
  });

  // Same form for adding and editing a property (edit fixes rates entered
  // wrong or before the deal was final).
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (p: LandProperty) => {
    setEditingId(p.id);
    setForm({
      property_type: p.property_type,
      area_location: p.area_location,
      size_number: String(p.size_number ?? ""),
      size_unit: p.size_unit,
      owner_vendor: p.owner_vendor ?? "",
      purchase_rate: p.purchase_rate != null ? String(p.purchase_rate) : "",
      sale_rate: p.sale_rate != null ? String(p.sale_rate) : "",
      remarks: p.remarks ?? "",
    });
    setModalOpen(true);
  };

  const saveProperty = useMutation({
    mutationFn: async () => {
      const body = {
        property_type: form.property_type,
        area_location: form.area_location,
        size_number: form.size_number ? Number(form.size_number) : 0,
        size_unit: form.size_unit,
        owner_vendor: form.owner_vendor || null,
        purchase_rate: form.purchase_rate ? Number(form.purchase_rate) : null,
        sale_rate: form.sale_rate ? Number(form.sale_rate) : null,
        remarks: form.remarks || null,
      };
      return editingId
        ? (await api.put<LandProperty>(`/land-properties/${editingId}`, body)).data
        : (await api.post<LandProperty>("/land-properties/", body)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["land-properties"] });
      setModalOpen(false);
      setForm(emptyForm);
      toast.success(editingId ? "Property updated." : "Property added.");
      setEditingId(null);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to save property.")),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, sale_rate }: { id: number; status: LandPropertyStatus; sale_rate?: number }) =>
      api.put(`/land-properties/${id}`, sale_rate !== undefined ? { status, sale_rate } : { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["land-properties"] });
      setSellProperty(null);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update status.")),
  });

  // Marking Sold asks for the price it actually sold for — it often differs
  // from the rate hoped for at entry (e.g. planned 15 lac, sold at 11 lac).
  const [sellProperty, setSellProperty] = React.useState<LandProperty | null>(null);
  const [sellPrice, setSellPrice] = React.useState("");
  const changeStatus = (p: LandProperty, status: LandPropertyStatus) => {
    if (status === "Sold") {
      setSellProperty(p);
      setSellPrice(p.sale_rate != null ? String(p.sale_rate) : "");
    } else {
      updateStatus.mutate({ id: p.id, status });
    }
  };

  const [detailPropertyId, setDetailPropertyId] = React.useState<number | null>(null);
  const detailProperty = properties?.find((p) => p.id === detailPropertyId) ?? null;

  const [paymentModalOpen, setPaymentModalOpen] = React.useState(false);
  const [paymentForm, setPaymentForm] = React.useState(emptyPaymentForm);
  const [paymentError, setPaymentError] = React.useState<string | null>(null);

  const paymentDirection: LandPropertyPaymentDirection =
    detailProperty?.status === "Sold" ? "From Buyer" : "To Seller";

  const recordPayment = useMutation({
    mutationFn: async () =>
      api.post(`/land-properties/${detailProperty!.id}/payments`, {
        direction: paymentDirection,
        amount: Number(paymentForm.amount),
        payment_date: paymentForm.payment_date || todayIso(),
        mode_of_payment: paymentForm.mode_of_payment,
        narration: paymentForm.narration || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["land-properties"] });
      setPaymentModalOpen(false);
      setPaymentForm(emptyPaymentForm);
      setPaymentError(null);
      toast.success("Payment recorded.");
    },
    onError: (err: unknown) => setPaymentError(apiErrorMessage(err, "Failed to record payment.")),
  });

  const deletePayment = useMutation({
    mutationFn: async (paymentId: number) => api.delete(`/land-properties/payments/${paymentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["land-properties"] }),
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete payment.")),
  });

  const updateDueDate = useMutation({
    mutationFn: async ({ id, field, value }: { id: number; field: string; value: string }) =>
      api.put(`/land-properties/${id}`, { [field]: value || null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["land-properties"] }),
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update due date.")),
  });

  const deleteProperty = useMutation({
    mutationFn: async (id: number) => api.delete(`/land-properties/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["land-properties"] }),
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete property."));
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Land / Plots / Commercial</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Non-flat inventory — open plots, land and commercial shops handled as a dealer.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Property
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-44">
          <option value="">All Types</option>
          {propertyTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-44">
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Ref No.</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Area / Location</th>
              <th className="px-5 py-3 font-medium">Size</th>
              <th className="px-5 py-3 font-medium">Purchase</th>
              <th className="px-5 py-3 font-medium">Sale Price</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <TableRowsSkeleton rows={4} cols={8} />}
            {!isLoading && properties?.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No properties yet. Click "New Property" to add plots/land/commercial units.
                </td>
              </tr>
            )}
            {properties?.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{p.property_ref_no}</td>
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{p.property_type}</td>
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    {p.area_location}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {Number(p.size_number).toLocaleString()} {p.size_unit}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {p.purchase_rate ? `PKR ${Number(p.purchase_rate).toLocaleString()}` : "—"}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {p.sale_rate ? `PKR ${Number(p.sale_rate).toLocaleString()}` : "—"}
                  {p.status === "Sold" && p.sale_rate && p.purchase_rate && (
                    <span
                      className={`block text-xs ${
                        Number(p.sale_rate) >= Number(p.purchase_rate) ? "text-success-700" : "text-danger-600"
                      }`}
                    >
                      {Number(p.sale_rate) >= Number(p.purchase_rate) ? "Profit" : "Loss"} PKR{" "}
                      {Math.abs(Number(p.sale_rate) - Number(p.purchase_rate)).toLocaleString()}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  {p.status === "Rented" ? (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400" title="Managed from Rentals">
                      Rented
                    </span>
                  ) : (
                    <Select
                      value={p.status}
                      onChange={(e) => changeStatus(p, e.target.value as LandPropertyStatus)}
                      className="h-8 w-32 text-xs"
                    >
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(p)}
                      title="Edit property"
                      className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {(p.status === "Reserved" || p.status === "Sold") && (
                      <button
                        onClick={() => setDetailPropertyId(p.id)}
                        title="Payments"
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 hover:text-navy-700 dark:hover:bg-navy-800"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const ok = await confirm(`Delete property "${p.property_ref_no}"?`, {
                          danger: true,
                          confirmLabel: "Delete",
                        });
                        if (ok) deleteProperty.mutate(p.id);
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Property" : "New Property"}
        description={
          editingId
            ? "Correct the details or rates — e.g. set the actual sale price."
            : "Add a plot, land, or commercial unit to inventory."
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveProperty.mutate();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="property_type">Property Type</Label>
              <Select
                id="property_type"
                value={form.property_type}
                onChange={(e) => setForm({ ...form, property_type: e.target.value as PropertyType })}
              >
                {propertyTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="area_location">Area / Location</Label>
              <Input
                id="area_location"
                required
                value={form.area_location}
                onChange={(e) => setForm({ ...form, area_location: e.target.value })}
                placeholder="e.g. Korangi Industrial Area"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="size_number">Size</Label>
              <Input
                id="size_number"
                type="number"
                value={form.size_number}
                onChange={(e) => setForm({ ...form, size_number: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="size_unit">Unit</Label>
              <Select
                id="size_unit"
                value={form.size_unit}
                onChange={(e) => setForm({ ...form, size_unit: e.target.value as SizeUnit })}
              >
                {sizeUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="owner_vendor">Owner / Vendor</Label>
            <Input
              id="owner_vendor"
              value={form.owner_vendor}
              onChange={(e) => setForm({ ...form, owner_vendor: e.target.value })}
              placeholder="Whose property is being sold/dealt"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="purchase_rate">Purchase Rate</Label>
              <Input
                id="purchase_rate"
                type="number"
                value={form.purchase_rate}
                onChange={(e) => setForm({ ...form, purchase_rate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sale_rate">Sale Price{editingId ? "" : " (expected)"}</Label>
              <Input
                id="sale_rate"
                type="number"
                value={form.sale_rate}
                onChange={(e) => setForm({ ...form, sale_rate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Input
              id="remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveProperty.isPending}>
              {editingId ? "Save Changes" : "Add Property"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Payments Detail Modal ---- */}
      <Modal
        open={!!detailProperty}
        onClose={() => setDetailPropertyId(null)}
        title={detailProperty ? `Payments — ${detailProperty.property_ref_no}` : ""}
      >
        {detailProperty && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {detailProperty.area_location} · {detailProperty.status}
              </span>
              <Button size="sm" onClick={() => setPaymentModalOpen(true)}>
                <Wallet className="h-3.5 w-3.5" />
                {detailProperty.status === "Sold" ? "Record Receipt" : "Record Payment"}
              </Button>
            </div>

            {(() => {
              const isSold = detailProperty.status === "Sold";
              const total = Number((isSold ? detailProperty.sale_rate : detailProperty.purchase_rate) ?? 0);
              const direction: LandPropertyPaymentDirection = isSold ? "From Buyer" : "To Seller";
              const relevantPayments = detailProperty.payments
                .filter((pm) => pm.direction === direction)
                .slice()
                .sort((a, b) => a.payment_date.localeCompare(b.payment_date));
              const totalMoved = relevantPayments.reduce((s, pm) => s + Number(pm.amount), 0);
              const remaining = Math.round((total - totalMoved) * 100) / 100;
              const dueField = isSold ? "buyer_payment_due_date" : "seller_payment_due_date";
              const dueValue = (isSold ? detailProperty.buyer_payment_due_date : detailProperty.seller_payment_due_date) ?? "";
              const purchase = Number(detailProperty.purchase_rate ?? 0);
              const profit = total - purchase;

              return (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="flex items-center gap-1 text-xs text-slate-400">
                        {isSold ? "Sale Price" : "Purchase Rate"}
                        <button
                          type="button"
                          onClick={() => openEdit(detailProperty)}
                          title="Edit rate"
                          className="rounded p-0.5 hover:text-brand-600"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </p>
                      <p className="font-medium text-navy-900 dark:text-slate-100">
                        PKR {total.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{isSold ? "Received" : "Paid"}</p>
                      <p className="font-medium text-success-700">PKR {totalMoved.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Remaining</p>
                      {remaining > 0 ? (
                        <p className="font-medium text-danger-600">PKR {remaining.toLocaleString()}</p>
                      ) : remaining === 0 ? (
                        <p className="font-medium text-success-700">
                          Fully {isSold ? "received" : "paid"}
                        </p>
                      ) : (
                        <p className="font-medium text-warning-700">
                          Excess PKR {Math.abs(remaining).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSold && purchase > 0 && (
                    <p
                      className={`rounded-lg px-3 py-2 text-sm ${
                        profit >= 0 ? "bg-success-50 text-success-700" : "bg-danger-50 text-danger-700"
                      }`}
                    >
                      Bought for PKR {purchase.toLocaleString()}, sold for PKR {total.toLocaleString()} —{" "}
                      <strong>
                        {profit >= 0 ? "Profit" : "Loss"} PKR {Math.abs(profit).toLocaleString()}
                      </strong>
                    </p>
                  )}

                  <div>
                    <Label htmlFor="due_date">
                      Next {isSold ? "receivable" : "payable"} due date
                    </Label>
                    <Input
                      id="due_date"
                      type="date"
                      value={dueValue}
                      onChange={(e) =>
                        updateDueDate.mutate({ id: detailProperty.id, field: dueField, value: e.target.value })
                      }
                    />
                  </div>

                  {relevantPayments.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {isSold ? "Receipts" : "Payments"}
                      </p>
                      <div className="space-y-1.5">
                        {relevantPayments.map((pm) => (
                          <div
                            key={pm.id}
                            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-navy-800"
                          >
                            <span className="text-navy-900 dark:text-slate-100">
                              {pm.payment_date} · PKR {Number(pm.amount).toLocaleString()} · {pm.mode_of_payment}
                            </span>
                            <button
                              onClick={async () => {
                                const ok = await confirm("Delete this entry?", {
                                  danger: true,
                                  confirmLabel: "Delete",
                                });
                                if (ok) deletePayment.mutate(pm.id);
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
                </>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* ---- Mark as Sold Modal ---- */}
      <Modal
        open={!!sellProperty}
        onClose={() => setSellProperty(null)}
        title={sellProperty ? `Mark ${sellProperty.property_ref_no} as Sold` : ""}
        description="Enter the price it actually sold for — the buyer's remaining balance is worked out from this."
      >
        {sellProperty && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateStatus.mutate({ id: sellProperty.id, status: "Sold", sale_rate: Number(sellPrice) });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="sell_price">Actual Sale Price (PKR)</Label>
              <Input
                id="sell_price"
                type="number"
                min="1"
                step="0.01"
                required
                autoFocus
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
              {sellProperty.sale_rate != null && (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Expected sale price was PKR {Number(sellProperty.sale_rate).toLocaleString()} — change it if the
                  deal closed at a different price.
                </p>
              )}
            </div>
            {sellProperty.purchase_rate != null && Number(sellPrice) > 0 && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${
                  Number(sellPrice) >= Number(sellProperty.purchase_rate)
                    ? "bg-success-50 text-success-700"
                    : "bg-danger-50 text-danger-700"
                }`}
              >
                Purchase PKR {Number(sellProperty.purchase_rate).toLocaleString()} →{" "}
                {Number(sellPrice) >= Number(sellProperty.purchase_rate) ? "Profit" : "Loss"} PKR{" "}
                {Math.abs(Number(sellPrice) - Number(sellProperty.purchase_rate)).toLocaleString()}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setSellProperty(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateStatus.isPending || !(Number(sellPrice) > 0)}>
                Mark as Sold
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ---- Record Payment Modal ---- */}
      <Modal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setPaymentError(null);
        }}
        title={detailProperty?.status === "Sold" ? "Record Receipt from Buyer" : "Record Payment to Seller"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            recordPayment.mutate();
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
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <Label htmlFor="payment_mode">Mode of Payment</Label>
              <Select
                id="payment_mode"
                value={paymentForm.mode_of_payment}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, mode_of_payment: e.target.value as PaymentMode })
                }
              >
                {paymentModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="payment_narration">Narration (optional)</Label>
            <Input
              id="payment_narration"
              value={paymentForm.narration}
              onChange={(e) => setPaymentForm({ ...paymentForm, narration: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              Record
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
