import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type { LandProperty, LandPropertyStatus, PropertyType, SizeUnit } from "../types";

const propertyTypes: PropertyType[] = ["Plot", "Land", "Commercial Shop", "SR", "Other"];
const sizeUnits: SizeUnit[] = ["Sq. Yd.", "Sq. Ft.", "Marla", "Kanal"];
const statuses: LandPropertyStatus[] = ["Available", "Reserved", "Sold"];

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

  const createProperty = useMutation({
    mutationFn: async () =>
      (
        await api.post<LandProperty>("/land-properties/", {
          property_type: form.property_type,
          area_location: form.area_location,
          size_number: form.size_number ? Number(form.size_number) : 0,
          size_unit: form.size_unit,
          owner_vendor: form.owner_vendor || null,
          purchase_rate: form.purchase_rate ? Number(form.purchase_rate) : null,
          sale_rate: form.sale_rate ? Number(form.sale_rate) : null,
          remarks: form.remarks || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["land-properties"] });
      setModalOpen(false);
      setForm(emptyForm);
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: LandPropertyStatus }) =>
      api.put(`/land-properties/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["land-properties"] }),
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
        <Button onClick={() => setModalOpen(true)}>
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
              <th className="px-5 py-3 font-medium">Sale Rate</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <TableRowsSkeleton rows={4} cols={7} />}
            {!isLoading && properties?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
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
                  {p.sale_rate ? `PKR ${Number(p.sale_rate).toLocaleString()}` : "—"}
                </td>
                <td className="px-5 py-3">
                  <Select
                    value={p.status}
                    onChange={(e) =>
                      updateStatus.mutate({ id: p.id, status: e.target.value as LandPropertyStatus })
                    }
                    className="h-8 w-32 text-xs"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-5 py-3 text-right">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Property"
        description="Add a plot, land, or commercial unit to inventory."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createProperty.mutate();
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
              <Label htmlFor="sale_rate">Sale Rate</Label>
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
            <Button type="submit" disabled={createProperty.isPending}>
              Add Property
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
