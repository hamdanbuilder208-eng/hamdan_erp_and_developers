import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MapPin, Plus, Printer, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { RentAgreementStatusBadge } from "../components/ui/Badge";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type { Account, LandProperty, RentAgreement, RentReceipt, Tenant, Unit } from "../types";

type RentalTab = "agreements" | "tenants";

const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyTenantForm = { name: "", cnic: "", mobile: "", address: "" };
const emptyAgreementForm = {
  tenant_id: "",
  target_type: "property" as "unit" | "property",
  target_id: "",
  monthly_rent: "",
  security_deposit: "",
  start_date: todayIso(),
  duration_months: "12",
  narration: "",
};
const emptyReceiptForm = { amount: "", credit_account_id: "", mode_of_payment: "Cash" };

function targetLabel(a: RentAgreement) {
  if (a.unit) return `${a.unit.unit_ref_no} — ${a.unit.unit_number}`;
  if (a.land_property) return `${a.land_property.property_ref_no} — ${a.land_property.area_location}`;
  return "—";
}

function nextDueLabel(a: RentAgreement) {
  const due = a.schedule_lines
    .slice()
    .sort((x, y) => x.month_no - y.month_no)
    .find((l) => Number(l.paid_amount) < Number(l.amount));
  if (!due) return "Fully paid";
  return `Month ${due.month_no} — ${due.due_date}`;
}

export default function RentalsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<RentalTab>("agreements");

  const [tenantModalOpen, setTenantModalOpen] = React.useState(false);
  const [tenantForm, setTenantForm] = React.useState(emptyTenantForm);

  const [agreementModalOpen, setAgreementModalOpen] = React.useState(false);
  const [agreementForm, setAgreementForm] = React.useState(emptyAgreementForm);
  const [agreementError, setAgreementError] = React.useState<string | null>(null);

  const [detailAgreement, setDetailAgreement] = React.useState<RentAgreement | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = React.useState(false);
  const [receiptForm, setReceiptForm] = React.useState(emptyReceiptForm);
  const [receiptError, setReceiptError] = React.useState<string | null>(null);

  const { data: agreements, isLoading: agreementsLoading } = useQuery({
    queryKey: ["rentals", "agreements"],
    queryFn: async () => (await api.get<RentAgreement[]>("/rentals/agreements")).data,
  });
  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ["rentals", "tenants"],
    queryFn: async () => (await api.get<Tenant[]>("/rentals/tenants")).data,
  });
  const { data: availableUnits } = useQuery({
    queryKey: ["units", "available"],
    queryFn: async () => (await api.get<Unit[]>("/units/", { params: { status_filter: "Available" } })).data,
    enabled: agreementModalOpen,
  });
  const { data: availableProperties } = useQuery({
    queryKey: ["land-properties", "available"],
    queryFn: async () =>
      (await api.get<LandProperty[]>("/land-properties/", { params: { status_filter: "Available" } })).data,
    enabled: agreementModalOpen,
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
    enabled: receiptModalOpen,
  });
  const { data: receipts } = useQuery({
    queryKey: ["rentals", "receipts", detailAgreement?.id],
    queryFn: async () =>
      (await api.get<RentReceipt[]>("/rentals/receipts", { params: { agreement_id: detailAgreement!.id } })).data,
    enabled: !!detailAgreement,
  });

  const cashBankAccounts = accounts?.filter((a) => a.nature === "Asset" && !a.is_control) ?? [];

  const refreshDetail = async (id: number) => {
    const { data } = await api.get<RentAgreement>(`/rentals/agreements/${id}`);
    setDetailAgreement(data);
  };

  const createTenant = useMutation({
    mutationFn: async () =>
      (
        await api.post<Tenant>("/rentals/tenants", {
          name: tenantForm.name,
          cnic: tenantForm.cnic || null,
          mobile: tenantForm.mobile || null,
          address: tenantForm.address || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals", "tenants"] });
      setTenantModalOpen(false);
      setTenantForm(emptyTenantForm);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to add tenant.")),
  });

  const deleteTenant = useMutation({
    mutationFn: async (id: number) => api.delete(`/rentals/tenants/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rentals", "tenants"] }),
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete tenant.")),
  });

  const createAgreement = useMutation({
    mutationFn: async () =>
      (
        await api.post<RentAgreement>("/rentals/agreements", {
          agreement_date: todayIso(),
          tenant_id: Number(agreementForm.tenant_id),
          unit_id: agreementForm.target_type === "unit" ? Number(agreementForm.target_id) : null,
          land_property_id:
            agreementForm.target_type === "property" ? Number(agreementForm.target_id) : null,
          monthly_rent: Number(agreementForm.monthly_rent),
          security_deposit: Number(agreementForm.security_deposit || 0),
          start_date: agreementForm.start_date,
          duration_months: Number(agreementForm.duration_months),
          narration: agreementForm.narration || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals", "agreements"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["land-properties"] });
      setAgreementModalOpen(false);
      setAgreementForm(emptyAgreementForm);
      setAgreementError(null);
    },
    onError: (err: unknown) => setAgreementError(apiErrorMessage(err, "Failed to create agreement.")),
  });

  const terminateAgreement = useMutation({
    mutationFn: async (id: number) =>
      (await api.post<RentAgreement>(`/rentals/agreements/${id}/terminate`, null, {
        params: { end_date: todayIso() },
      })).data,
    onSuccess: async (updated) => {
      queryClient.invalidateQueries({ queryKey: ["rentals", "agreements"] });
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["land-properties"] });
      setDetailAgreement(updated);
      toast.success("Agreement terminated.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to terminate agreement.")),
  });

  const deleteAgreement = useMutation({
    mutationFn: async (id: number) => api.delete(`/rentals/agreements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rentals", "agreements"] });
      setDetailAgreement(null);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete agreement.")),
  });

  const createReceipt = useMutation({
    mutationFn: async () =>
      (
        await api.post<RentReceipt>("/rentals/receipts", {
          receipt_date: todayIso(),
          agreement_id: detailAgreement!.id,
          credit_account_id: Number(receiptForm.credit_account_id),
          amount: Number(receiptForm.amount),
          mode_of_payment: receiptForm.mode_of_payment,
        })
      ).data,
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      await refreshDetail(detailAgreement!.id);
      setReceiptModalOpen(false);
      setReceiptForm(emptyReceiptForm);
      setReceiptError(null);
      toast.success("Rent receipt recorded.");
    },
    onError: (err: unknown) => setReceiptError(apiErrorMessage(err, "Failed to record receipt.")),
  });

  const deleteReceipt = useMutation({
    mutationFn: async (id: number) => api.delete(`/rentals/receipts/${id}`),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["rentals"] });
      if (detailAgreement) await refreshDetail(detailAgreement.id);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete receipt.")),
  });

  const targetOptions = agreementForm.target_type === "unit" ? availableUnits ?? [] : availableProperties ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Rentals</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Shops and extra properties rented out to tenants — monthly schedule, collections and
            accounting handled the same way as a sale booking.
          </p>
        </div>
        {tab === "agreements" ? (
          <Button onClick={() => setAgreementModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Agreement
          </Button>
        ) : (
          <Button onClick={() => setTenantModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Tenant
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-navy-700">
        {(
          [
            { key: "agreements", label: "Agreements" },
            { key: "tenants", label: "Tenants" },
          ] as { key: RentalTab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "agreements" && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Agreement</th>
                <th className="px-5 py-3 font-medium">Tenant</th>
                <th className="px-5 py-3 font-medium">Rented</th>
                <th className="px-5 py-3 font-medium">Monthly Rent</th>
                <th className="px-5 py-3 font-medium">Next Due</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {agreementsLoading && <TableRowsSkeleton cols={6} />}
              {!agreementsLoading && agreements?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No rent agreements yet. Click "New Agreement" to rent out a shop or a property.
                  </td>
                </tr>
              )}
              {agreements?.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setDetailAgreement(a)}
                  className="cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-navy-800"
                >
                  <td className="px-5 py-3 font-mono text-navy-900 dark:text-slate-100">{a.agreement_no}</td>
                  <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{a.tenant.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5">
                      {a.unit ? <Building2 className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                      {targetLabel(a)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                    PKR {Number(a.monthly_rent).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {a.status === "Active" ? nextDueLabel(a) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <RentAgreementStatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "tenants" && (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">CNIC</th>
                <th className="px-5 py-3 font-medium">Mobile</th>
                <th className="px-5 py-3 font-medium">Address</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {tenantsLoading && <TableRowsSkeleton cols={5} />}
              {!tenantsLoading && tenants?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No tenants yet. Click "Add Tenant" to get started.
                  </td>
                </tr>
              )}
              {tenants?.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                  <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{t.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{t.cnic ?? "—"}</td>
                  <td className="px-5 py-3 font-mono text-slate-500 dark:text-slate-400">{t.mobile ?? "—"}</td>
                  <td className="px-5 py-3 max-w-xs truncate text-slate-500 dark:text-slate-400">
                    {t.address ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={async () => {
                        const ok = await confirm("Delete this tenant?", { danger: true, confirmLabel: "Delete" });
                        if (ok) deleteTenant.mutate(t.id);
                      }}
                      title="Delete tenant"
                      className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ---- Add Tenant Modal ---- */}
      <Modal open={tenantModalOpen} onClose={() => setTenantModalOpen(false)} title="Add Tenant">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createTenant.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="tenant_name">Name</Label>
            <Input
              id="tenant_name"
              required
              value={tenantForm.name}
              onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tenant_cnic">CNIC (optional)</Label>
              <Input
                id="tenant_cnic"
                value={tenantForm.cnic}
                onChange={(e) => setTenantForm({ ...tenantForm, cnic: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="tenant_mobile">Mobile (optional)</Label>
              <Input
                id="tenant_mobile"
                value={tenantForm.mobile}
                onChange={(e) => setTenantForm({ ...tenantForm, mobile: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="tenant_address">Address (optional)</Label>
            <Input
              id="tenant_address"
              value={tenantForm.address}
              onChange={(e) => setTenantForm({ ...tenantForm, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTenantModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTenant.isPending}>
              Add Tenant
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- New Agreement Modal ---- */}
      <Modal
        open={agreementModalOpen}
        onClose={() => {
          setAgreementModalOpen(false);
          setAgreementError(null);
        }}
        title="New Rent Agreement"
        description="Pick a tenant and a shop or property that's currently Available — it'll be marked Rented once this is saved."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createAgreement.mutate();
          }}
          className="space-y-4"
        >
          {agreementError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{agreementError}</p>
          )}
          <div>
            <Label htmlFor="agreement_tenant">Tenant</Label>
            <Select
              id="agreement_tenant"
              required
              value={agreementForm.tenant_id}
              onChange={(e) => setAgreementForm({ ...agreementForm, tenant_id: e.target.value })}
            >
              <option value="">Select tenant</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.mobile ? `(${t.mobile})` : ""}
                </option>
              ))}
            </Select>
            {(tenants?.length ?? 0) === 0 && (
              <p className="mt-1 text-xs text-slate-400">
                No tenants yet — add one from the Tenants tab first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agreement_target_type">Renting a...</Label>
              <Select
                id="agreement_target_type"
                value={agreementForm.target_type}
                onChange={(e) =>
                  setAgreementForm({
                    ...agreementForm,
                    target_type: e.target.value as "unit" | "property",
                    target_id: "",
                  })
                }
              >
                <option value="property">Extra Property</option>
                <option value="unit">Project Unit / Shop</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="agreement_target">
                {agreementForm.target_type === "unit" ? "Unit" : "Property"}
              </Label>
              <Select
                id="agreement_target"
                required
                value={agreementForm.target_id}
                onChange={(e) => setAgreementForm({ ...agreementForm, target_id: e.target.value })}
              >
                <option value="">Select {agreementForm.target_type === "unit" ? "unit" : "property"}</option>
                {agreementForm.target_type === "unit"
                  ? (targetOptions as Unit[]).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.unit_ref_no} — {u.unit_number}
                      </option>
                    ))
                  : (targetOptions as LandProperty[]).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.property_ref_no} — {p.area_location}
                      </option>
                    ))}
              </Select>
              {targetOptions.length === 0 && (
                <p className="mt-1 text-xs text-slate-400">
                  Nothing currently available to rent in this category.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agreement_rent">Monthly Rent (PKR)</Label>
              <Input
                id="agreement_rent"
                type="number"
                min="1"
                required
                value={agreementForm.monthly_rent}
                onChange={(e) => setAgreementForm({ ...agreementForm, monthly_rent: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="agreement_deposit">Security Deposit (optional)</Label>
              <Input
                id="agreement_deposit"
                type="number"
                min="0"
                value={agreementForm.security_deposit}
                onChange={(e) => setAgreementForm({ ...agreementForm, security_deposit: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agreement_start">Start Date</Label>
              <Input
                id="agreement_start"
                type="date"
                required
                value={agreementForm.start_date}
                onChange={(e) => setAgreementForm({ ...agreementForm, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="agreement_duration">Duration (months)</Label>
              <Input
                id="agreement_duration"
                type="number"
                min="1"
                required
                value={agreementForm.duration_months}
                onChange={(e) => setAgreementForm({ ...agreementForm, duration_months: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="agreement_narration">Narration (optional)</Label>
            <Input
              id="agreement_narration"
              value={agreementForm.narration}
              onChange={(e) => setAgreementForm({ ...agreementForm, narration: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAgreementModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAgreement.isPending}>
              Create Agreement
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Agreement Detail Modal ---- */}
      <Modal
        open={!!detailAgreement}
        onClose={() => setDetailAgreement(null)}
        title={detailAgreement?.agreement_no ?? ""}
        description={detailAgreement ? `${detailAgreement.tenant.name} — ${targetLabel(detailAgreement)}` : undefined}
      >
        {detailAgreement && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <RentAgreementStatusBadge status={detailAgreement.status} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => window.open(`/rentals/agreements/${detailAgreement.id}/print`, "_blank")}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Agreement
                </Button>
                {detailAgreement.status === "Active" && (
                  <>
                    <Button size="sm" onClick={() => setReceiptModalOpen(true)}>
                      <ReceiptIcon className="h-3.5 w-3.5" />
                      Record Receipt
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        const ok = await confirm("Terminate this rent agreement today?", {
                          confirmLabel: "Terminate",
                        });
                        if (ok) terminateAgreement.mutate(detailAgreement.id);
                      }}
                    >
                      Terminate
                    </Button>
                  </>
                )}
                <button
                  onClick={async () => {
                    const ok = await confirm("Permanently delete this rent agreement?", {
                      danger: true,
                      confirmLabel: "Delete",
                    });
                    if (ok) deleteAgreement.mutate(detailAgreement.id);
                  }}
                  title="Delete agreement"
                  className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Monthly Rent</p>
                <p className="font-medium text-navy-900 dark:text-slate-100">
                  PKR {Number(detailAgreement.monthly_rent).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Security Deposit</p>
                <p className="font-medium text-navy-900 dark:text-slate-100">
                  PKR {Number(detailAgreement.security_deposit).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Start Date</p>
                <p className="font-medium text-navy-900 dark:text-slate-100">{detailAgreement.start_date}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Monthly Schedule
              </p>
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-navy-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Month</th>
                      <th className="px-3 py-2 font-medium">Due Date</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                    {detailAgreement.schedule_lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2">{l.month_no}</td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{l.due_date}</td>
                        <td className="px-3 py-2">{Number(l.amount).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          {Number(l.paid_amount) >= Number(l.amount) ? (
                            <span className="text-success-700">Paid</span>
                          ) : Number(l.paid_amount) > 0 ? (
                            <span className="text-warning-700">
                              {Number(l.paid_amount).toLocaleString()} partial
                            </span>
                          ) : (
                            <span className="text-slate-400">Due</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {receipts && receipts.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Receipts
                </p>
                <div className="space-y-1.5">
                  {receipts.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-navy-800"
                    >
                      <span className="text-navy-900 dark:text-slate-100">
                        {r.receipt_no} · {r.receipt_date} · PKR {Number(r.amount).toLocaleString()}
                      </span>
                      <button
                        onClick={async () => {
                          const ok = await confirm("Delete this receipt?", { danger: true, confirmLabel: "Delete" });
                          if (ok) deleteReceipt.mutate(r.id);
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

      {/* ---- Record Receipt Modal ---- */}
      <Modal
        open={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptError(null);
        }}
        title="Record Rent Receipt"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createReceipt.mutate();
          }}
          className="space-y-4"
        >
          {receiptError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{receiptError}</p>
          )}
          <div>
            <Label htmlFor="receipt_amount">Amount (PKR)</Label>
            <Input
              id="receipt_amount"
              type="number"
              min="1"
              required
              value={receiptForm.amount}
              onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="receipt_mode">Mode of Payment</Label>
              <Select
                id="receipt_mode"
                value={receiptForm.mode_of_payment}
                onChange={(e) => setReceiptForm({ ...receiptForm, mode_of_payment: e.target.value })}
              >
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Online">Online</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="receipt_account">Received Into</Label>
              <Select
                id="receipt_account"
                required
                value={receiptForm.credit_account_id}
                onChange={(e) => setReceiptForm({ ...receiptForm, credit_account_id: e.target.value })}
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setReceiptModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createReceipt.isPending}>
              Record Receipt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
