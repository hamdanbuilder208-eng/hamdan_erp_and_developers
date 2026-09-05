import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Plus, Printer, QrCode, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Badge, PurchaseOrderStatusBadge, MaterialIssueStatusBadge } from "../components/ui/Badge";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import { QrImage } from "../components/ui/QrImage";
import { toast } from "../lib/toast";
import { confirm } from "../lib/confirm";
import type {
  Account,
  GRN,
  Material,
  MaterialIssue,
  MaterialIssueReason,
  Project,
  ProjectStock,
  PurchaseOrder,
  StockBalance,
  Vendor,
  Warehouse,
} from "../types";

type InventoryTab =
  | "vendors"
  | "warehouses"
  | "materials"
  | "purchase-orders"
  | "grn"
  | "issues"
  | "stock";

const todayIso = () => new Date().toISOString().slice(0, 10);

const errorMessage = (err: unknown, fallback: string) => {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).join(", ");
  return typeof detail === "string" ? detail : fallback;
};

interface QtyRateLine {
  material_id: string;
  quantity: string;
  rate: string;
}

const emptyLine = (): QtyRateLine => ({ material_id: "", quantity: "", rate: "" });

export default function MaterialInventoryPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<InventoryTab>("vendors");

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.get<Account[]>("/accounts/")).data,
  });
  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => (await api.get<Vendor[]>("/inventory/vendors")).data,
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get<Warehouse[]>("/inventory/warehouses")).data,
  });
  const { data: materials } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await api.get<Material[]>("/inventory/materials")).data,
  });

  const paymentAccounts = accounts?.filter((a) => !a.is_control) ?? [];

  // ---- Vendors ----
  const [vendorModalOpen, setVendorModalOpen] = React.useState(false);
  const [vendorForm, setVendorForm] = React.useState({
    name: "",
    ntn_cnic: "",
    phone: "",
    address: "",
  });

  const createVendor = useMutation({
    mutationFn: async () =>
      (
        await api.post<Vendor>("/inventory/vendors", {
          name: vendorForm.name,
          ntn_cnic: vendorForm.ntn_cnic || null,
          phone: vendorForm.phone || null,
          address: vendorForm.address || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setVendorModalOpen(false);
      setVendorForm({ name: "", ntn_cnic: "", phone: "", address: "" });
    },
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: number) => api.delete(`/inventory/vendors/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
    onError: (err: unknown) => toast.error(errorMessage(err, "Failed to delete vendor.")),
  });

  // ---- Warehouses ----
  const [warehouseModalOpen, setWarehouseModalOpen] = React.useState(false);
  const [warehouseForm, setWarehouseForm] = React.useState({ name: "", location: "" });

  const createWarehouse = useMutation({
    mutationFn: async () =>
      (
        await api.post<Warehouse>("/inventory/warehouses", {
          name: warehouseForm.name,
          location: warehouseForm.location || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      setWarehouseModalOpen(false);
      setWarehouseForm({ name: "", location: "" });
    },
  });

  const deleteWarehouse = useMutation({
    mutationFn: async (id: number) => api.delete(`/inventory/warehouses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["warehouses"] }),
    onError: (err: unknown) => toast.error(errorMessage(err, "Failed to delete warehouse.")),
  });

  const [qrWarehouse, setQrWarehouse] = React.useState<Warehouse | null>(null);

  // ---- Materials ----
  const [materialModalOpen, setMaterialModalOpen] = React.useState(false);
  const [materialForm, setMaterialForm] = React.useState({ name: "", unit_of_measure: "", category: "" });

  const createMaterial = useMutation({
    mutationFn: async () =>
      (
        await api.post<Material>("/inventory/materials", {
          name: materialForm.name,
          unit_of_measure: materialForm.unit_of_measure,
          category: materialForm.category || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      setMaterialModalOpen(false);
      setMaterialForm({ name: "", unit_of_measure: "", category: "" });
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: async (id: number) => api.delete(`/inventory/materials/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["materials"] }),
    onError: (err: unknown) => toast.error(errorMessage(err, "Failed to delete material.")),
  });

  const [historyMaterial, setHistoryMaterial] = React.useState<Material | null>(null);

  // ---- Purchase Orders ----
  const [poModalOpen, setPoModalOpen] = React.useState(false);
  const [poForm, setPoForm] = React.useState({ vendor_id: "", project_id: "", narration: "" });
  const [poLines, setPoLines] = React.useState<QtyRateLine[]>([emptyLine()]);
  const [poError, setPoError] = React.useState<string | null>(null);

  const { data: purchaseOrders, isLoading: poLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => (await api.get<PurchaseOrder[]>("/inventory/purchase-orders")).data,
  });
  const receivablePos = purchaseOrders?.filter((po) => po.status === "Draft" || po.status === "Approved") ?? [];

  const poTotal = poLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);

  const resetPoForm = () => {
    setPoForm({ vendor_id: "", project_id: "", narration: "" });
    setPoLines([emptyLine()]);
    setPoError(null);
  };

  const createPo = useMutation({
    mutationFn: async () =>
      (
        await api.post<PurchaseOrder>("/inventory/purchase-orders", {
          po_date: todayIso(),
          vendor_id: Number(poForm.vendor_id),
          project_id: poForm.project_id ? Number(poForm.project_id) : null,
          narration: poForm.narration || null,
          lines: poLines
            .filter((l) => l.material_id)
            .map((l) => ({
              material_id: Number(l.material_id),
              quantity: Number(l.quantity) || 0,
              rate: Number(l.rate) || 0,
            })),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setPoModalOpen(false);
      resetPoForm();
    },
    onError: (err: unknown) => setPoError(errorMessage(err, "Failed to save purchase order")),
  });

  const deletePo = useMutation({
    mutationFn: async (id: number) => api.delete(`/inventory/purchase-orders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
    onError: (err: unknown) => toast.error(errorMessage(err, "Failed to delete purchase order.")),
  });

  // ---- GRN ----
  const [grnModalOpen, setGrnModalOpen] = React.useState(false);
  const [grnForm, setGrnForm] = React.useState({
    vendor_id: "",
    warehouse_id: "",
    project_id: "",
    payment_account_id: "",
    narration: "",
    po_id: "",
  });
  const [grnLines, setGrnLines] = React.useState<QtyRateLine[]>([emptyLine()]);
  const [grnError, setGrnError] = React.useState<string | null>(null);

  const { data: grns, isLoading: grnLoading } = useQuery({
    queryKey: ["grns"],
    queryFn: async () => (await api.get<GRN[]>("/inventory/grn")).data,
  });

  const grnTotal = grnLines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);

  const resetGrnForm = () => {
    setGrnForm({
      vendor_id: "",
      warehouse_id: "",
      project_id: "",
      payment_account_id: "",
      narration: "",
      po_id: "",
    });
    setGrnLines([emptyLine()]);
    setGrnError(null);
  };

  const applyPoToGrn = (poId: string) => {
    const po = purchaseOrders?.find((p) => p.id === Number(poId));
    if (!po) {
      setGrnForm((f) => ({ ...f, po_id: "" }));
      return;
    }
    setGrnForm((f) => ({
      ...f,
      po_id: poId,
      vendor_id: String(po.vendor_id),
      project_id: po.project_id ? String(po.project_id) : "",
      narration: `Against ${po.po_no}`,
    }));
    setGrnLines(
      po.lines.map((l) => ({
        material_id: String(l.material_id),
        quantity: String(l.quantity),
        rate: String(l.rate),
      })),
    );
  };

  const openReceivePo = (po: PurchaseOrder) => {
    applyPoToGrn(String(po.id));
    setGrnError(null);
    setGrnModalOpen(true);
  };

  const createGrn = useMutation({
    mutationFn: async () =>
      (
        await api.post<GRN>("/inventory/grn", {
          grn_date: todayIso(),
          vendor_id: Number(grnForm.vendor_id),
          warehouse_id: Number(grnForm.warehouse_id),
          project_id: grnForm.project_id ? Number(grnForm.project_id) : null,
          po_id: grnForm.po_id ? Number(grnForm.po_id) : null,
          payment_account_id: Number(grnForm.payment_account_id),
          narration: grnForm.narration || null,
          lines: grnLines
            .filter((l) => l.material_id)
            .map((l) => ({
              material_id: Number(l.material_id),
              quantity: Number(l.quantity) || 0,
              rate: Number(l.rate) || 0,
            })),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grns"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setGrnModalOpen(false);
      resetGrnForm();
    },
    onError: (err: unknown) => setGrnError(errorMessage(err, "Failed to save GRN")),
  });

  const deleteGrn = useMutation({
    mutationFn: async (id: number) => api.delete(`/inventory/grn/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grns"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Failed to delete GRN.")),
  });

  // ---- Material Issues ----
  const [issueModalOpen, setIssueModalOpen] = React.useState(false);
  const [issueForm, setIssueForm] = React.useState({
    project_id: "",
    warehouse_id: "",
    reason: "Site Consumption" as MaterialIssueReason,
    issued_to: "",
    narration: "",
  });
  const [issueLines, setIssueLines] = React.useState<{ material_id: string; quantity: string }[]>([
    { material_id: "", quantity: "" },
  ]);
  const [issueError, setIssueError] = React.useState<string | null>(null);

  const { data: issues, isLoading: issuesLoading } = useQuery({
    queryKey: ["material-issues"],
    queryFn: async () => (await api.get<MaterialIssue[]>("/inventory/issues")).data,
    enabled: tab === "issues",
  });

  const resetIssueForm = () => {
    setIssueForm({
      project_id: "",
      warehouse_id: "",
      reason: "Site Consumption",
      issued_to: "",
      narration: "",
    });
    setIssueLines([{ material_id: "", quantity: "" }]);
    setIssueError(null);
  };

  const createIssue = useMutation({
    mutationFn: async () =>
      (
        await api.post<MaterialIssue>("/inventory/issues", {
          issue_date: todayIso(),
          project_id: Number(issueForm.project_id),
          warehouse_id: Number(issueForm.warehouse_id),
          reason: issueForm.reason,
          issued_to: issueForm.issued_to || null,
          narration: issueForm.narration || null,
          lines: issueLines
            .filter((l) => l.material_id)
            .map((l) => ({
              material_id: Number(l.material_id),
              quantity: Number(l.quantity) || 0,
            })),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-issues"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setIssueModalOpen(false);
      resetIssueForm();
    },
    onError: (err: unknown) => setIssueError(errorMessage(err, "Failed to save material issue")),
  });

  const deleteIssue = useMutation({
    mutationFn: async (id: number) => api.delete(`/inventory/issues/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-issues"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Failed to delete material issue.")),
  });

  const [resolveIssue, setResolveIssue] = React.useState<MaterialIssue | null>(null);
  const [resolutionNote, setResolutionNote] = React.useState("");
  const [resolveRestock, setResolveRestock] = React.useState(false);
  const [resolveError, setResolveError] = React.useState<string | null>(null);

  const resolveMutation = useMutation({
    mutationFn: async () =>
      (
        await api.put<MaterialIssue>(`/inventory/issues/${resolveIssue!.id}/resolve`, {
          resolution_note: resolutionNote || null,
          restock: resolveRestock,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-issues"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["stock"] });
      setResolveIssue(null);
      setResolutionNote("");
      setResolveRestock(false);
      setResolveError(null);
    },
    onError: (err: unknown) => setResolveError(errorMessage(err, "Failed to resolve issue")),
  });

  const [receiveIssue, setReceiveIssue] = React.useState<MaterialIssue | null>(null);
  const [receivedByInput, setReceivedByInput] = React.useState("");
  const [receiveError, setReceiveError] = React.useState<string | null>(null);

  const receiveMutation = useMutation({
    mutationFn: async () =>
      (
        await api.put<MaterialIssue>(`/inventory/issues/${receiveIssue!.id}/receive`, {
          received_by: receivedByInput,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-issues"] });
      setReceiveIssue(null);
      setReceivedByInput("");
      setReceiveError(null);
    },
    onError: (err: unknown) => setReceiveError(errorMessage(err, "Failed to confirm receipt")),
  });

  // ---- Stock ----
  const [stockView, setStockView] = React.useState<"warehouse" | "project">("warehouse");
  const [stockWarehouseFilter, setStockWarehouseFilter] = React.useState("");
  const { data: stock, isLoading: stockLoading } = useQuery({
    queryKey: ["stock", stockWarehouseFilter],
    queryFn: async () =>
      (
        await api.get<StockBalance[]>("/inventory/stock", {
          params: { warehouse_id: stockWarehouseFilter || undefined },
        })
      ).data,
    enabled: tab === "stock" && stockView === "warehouse",
  });

  const [stockProjectFilter, setStockProjectFilter] = React.useState("");
  const { data: projectStock, isLoading: projectStockLoading } = useQuery({
    queryKey: ["stock-by-project", stockProjectFilter],
    queryFn: async () =>
      (
        await api.get<ProjectStock[]>("/inventory/stock/by-project", {
          params: { project_id: stockProjectFilter || undefined },
        })
      ).data,
    enabled: tab === "stock" && stockView === "project",
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Material &amp; Inventory</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Vendors, warehouses, materials, purchase orders, goods receipt and site consumption — with
          running per-warehouse stock.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-navy-700">
        {(
          [
            { key: "vendors", label: "Vendors" },
            { key: "warehouses", label: "Warehouses" },
            { key: "materials", label: "Materials" },
            { key: "purchase-orders", label: "Purchase Orders" },
            { key: "grn", label: "GRN" },
            { key: "issues", label: "Material Issues" },
            { key: "stock", label: "Stock Balance" },
          ] as { key: InventoryTab; label: string }[]
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

      {tab === "vendors" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Vendors</h3>
            <Button size="sm" onClick={() => setVendorModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Vendor
            </Button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Vendor #</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">CNIC / NTN</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Address</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {vendors?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No vendors yet.
                  </td>
                </tr>
              )}
              {vendors?.map((v) => (
                <tr key={v.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {v.vendor_code}
                  </td>
                  <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{v.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {v.ntn_cnic ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{v.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{v.address ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={async () => {
                        const ok = await confirm(`Delete vendor "${v.name}"?`, { danger: true, confirmLabel: "Delete" });
                        if (ok) deleteVendor.mutate(v.id);
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
          </div>
        </Card>
      )}

      {tab === "warehouses" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Warehouses</h3>
            <Button size="sm" onClick={() => setWarehouseModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Warehouse
            </Button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Warehouse #</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {warehouses?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No warehouses yet. Click "New Warehouse" to add your first storage location.
                  </td>
                </tr>
              )}
              {warehouses?.map((w) => (
                <tr key={w.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {w.warehouse_code}
                  </td>
                  <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{w.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{w.location ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setQrWarehouse(w)}
                        title="Dispatch QR"
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirm(`Delete warehouse "${w.name}"?`, {
                            danger: true,
                            confirmLabel: "Delete",
                          });
                          if (ok) deleteWarehouse.mutate(w.id);
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
          </div>
        </Card>
      )}

      {tab === "materials" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Materials</h3>
            <Button size="sm" onClick={() => setMaterialModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Material
            </Button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Material #</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Unit</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Vendor(s)</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {materials?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No materials yet.
                  </td>
                </tr>
              )}
              {materials?.map((m) => {
                const vendorQtyMap = new Map<string, number>();
                for (const g of grns ?? []) {
                  for (const l of g.lines) {
                    if (l.material_id !== m.id) continue;
                    vendorQtyMap.set(g.vendor.name, (vendorQtyMap.get(g.vendor.name) ?? 0) + Number(l.quantity));
                  }
                }
                const vendorRows = Array.from(vendorQtyMap.entries());
                return (
                  <tr key={m.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {m.material_code}
                    </td>
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{m.name}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{m.unit_of_measure}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{m.category ?? "—"}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {vendorRows.length === 0 ? (
                        "—"
                      ) : (
                        <div className="space-y-0.5">
                          {vendorRows.map(([vendorName, qty]) => (
                            <div key={vendorName}>
                              {vendorName} — {qty.toLocaleString()} {m.unit_of_measure}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setHistoryMaterial(m)}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                          title="Purchase history"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm(`Delete material "${m.name}"?`, { danger: true, confirmLabel: "Delete" });
                            if (ok) deleteMaterial.mutate(m.id);
                          }}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {tab === "purchase-orders" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Purchase Orders</h3>
            <Button size="sm" onClick={() => setPoModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Purchase Order
            </Button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">PO #</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {poLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!poLoading && purchaseOrders?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No purchase orders yet.
                  </td>
                </tr>
              )}
              {purchaseOrders?.map((po) => {
                const total = po.lines.reduce((s, l) => s + l.amount, 0);
                return (
                  <tr key={po.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {po.po_no}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{po.po_date}</td>
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{po.vendor.name}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {po.project?.project_name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <PurchaseOrderStatusBadge status={po.status} />
                    </td>
                    <td className="px-5 py-3 text-right text-navy-900 dark:text-slate-100">
                      PKR {total.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {(po.status === "Draft" || po.status === "Approved") && (
                          <Button size="sm" variant="secondary" onClick={() => openReceivePo(po)}>
                            Receive
                          </Button>
                        )}
                        <button
                          onClick={() => window.open(`/inventory/po/${po.id}/print`, "_blank")}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm(`Delete purchase order "${po.po_no}"?`, {
                              danger: true,
                              confirmLabel: "Delete",
                            });
                            if (ok) deletePo.mutate(po.id);
                          }}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {tab === "grn" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">
              Goods Receipt Notes (GRN)
            </h3>
            <Button size="sm" onClick={() => setGrnModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New GRN
            </Button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">GRN #</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Warehouse</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {grnLoading && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!grnLoading && grns?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No GRNs yet.
                  </td>
                </tr>
              )}
              {grns?.map((g) => (
                <tr key={g.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                  <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {g.grn_no}
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{g.grn_date}</td>
                  <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{g.vendor.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {g.warehouse?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={g.voucher_id ? "success" : "warning"}>
                      {g.voucher_id ? "Received" : "Pending"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right text-navy-900 dark:text-slate-100">
                    PKR {g.total_amount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => window.open(`/inventory/grn/${g.id}/print`, "_blank")}
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await confirm(`Delete GRN "${g.grn_no}"?`, { danger: true, confirmLabel: "Delete" });
                          if (ok) deleteGrn.mutate(g.id);
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
          </div>
        </Card>
      )}

      {tab === "issues" && (
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Material Issues</h3>
            <Button size="sm" onClick={() => setIssueModalOpen(true)}>
              <Plus className="h-4 w-4" />
              New Issue
            </Button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Issue #</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Warehouse</th>
                <th className="px-5 py-3 font-medium">Project</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Issued To</th>
                <th className="px-5 py-3 font-medium">Delivery</th>
                <th className="px-5 py-3 font-medium">Resolution</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {issuesLoading && <TableRowsSkeleton rows={4} cols={10} />}
              {!issuesLoading && issues?.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                    No material issues yet.
                  </td>
                </tr>
              )}
              {issues?.map((iss) => {
                const total = iss.lines.reduce((s, l) => s + l.amount, 0);
                const isDamaged = iss.reason === "Damaged / Wastage";
                return (
                  <tr key={iss.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {iss.issue_no}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{iss.issue_date}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {iss.warehouse?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                      {iss.project.project_name}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={isDamaged ? "danger" : "neutral"}>{iss.reason}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {iss.issued_to ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {isDamaged ? (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      ) : (
                        <button
                          disabled={iss.status === "Received"}
                          onClick={() => iss.status === "Dispatched" && setReceiveIssue(iss)}
                          title={
                            iss.status === "Received"
                              ? `Received by ${iss.received_by ?? "—"} on ${iss.received_date ?? ""}`
                              : "Mark as received at site"
                          }
                        >
                          <MaterialIssueStatusBadge status={iss.status} />
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isDamaged ? (
                        <button
                          disabled={iss.resolved}
                          onClick={() => !iss.resolved && setResolveIssue(iss)}
                          title={iss.resolution_note ?? undefined}
                        >
                          <Badge tone={iss.resolved ? "success" : "warning"}>
                            {iss.resolved
                              ? `Resolved${iss.resolved_date ? ` · ${iss.resolved_date}` : ""}${iss.restocked ? " · Restocked" : ""}`
                              : "Mark Resolved"}
                          </Badge>
                        </button>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-navy-900 dark:text-slate-100">
                      PKR {total.toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => window.open(`/inventory/issue/${iss.id}/print`, "_blank")}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const ok = await confirm(`Delete material issue "${iss.issue_no}"?`, {
                              danger: true,
                              confirmLabel: "Delete",
                            });
                            if (ok) deleteIssue.mutate(iss.id);
                          }}
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {tab === "stock" && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-navy-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-slate-100">Stock Balance</h3>
              <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-navy-700">
                <button
                  onClick={() => setStockView("warehouse")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    stockView === "warehouse"
                      ? "bg-brand-600 text-white"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  By Warehouse
                </button>
                <button
                  onClick={() => setStockView("project")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    stockView === "project"
                      ? "bg-brand-600 text-white"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  By Project
                </button>
              </div>
            </div>
            {stockView === "warehouse" ? (
              <Select
                value={stockWarehouseFilter}
                onChange={(e) => setStockWarehouseFilter(e.target.value)}
                className="w-56"
              >
                <option value="">All Warehouses</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_code} — {w.name}
                  </option>
                ))}
              </Select>
            ) : (
              <Select
                value={stockProjectFilter}
                onChange={(e) => setStockProjectFilter(e.target.value)}
                className="w-56"
              >
                <option value="">All Projects</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {stockView === "warehouse" ? (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Material</th>
                  <th className="px-5 py-3 font-medium">Warehouse</th>
                  <th className="px-5 py-3 text-right font-medium">Quantity</th>
                  <th className="px-5 py-3 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {stockLoading && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}
                {!stockLoading && stock?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No stock movements recorded yet.
                    </td>
                  </tr>
                )}
                {stock?.map((s) => (
                  <tr key={`${s.material_id}-${s.warehouse_id}`} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{s.material_name}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {s.warehouse_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-navy-900 dark:text-slate-100">
                      {s.balance_qty.toLocaleString()} {s.unit_of_measure}
                    </td>
                    <td className="px-5 py-3 text-right text-navy-900 dark:text-slate-100">
                      PKR {s.balance_value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Material</th>
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 text-right font-medium">Received Qty</th>
                  <th className="px-5 py-3 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {projectStockLoading && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                      Loading...
                    </td>
                  </tr>
                )}
                {!projectStockLoading && projectStock?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No confirmed deliveries yet — quantities appear here once a site marks a delivery as received.
                    </td>
                  </tr>
                )}
                {projectStock?.map((s) => (
                  <tr key={`${s.material_id}-${s.project_id}`} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{s.material_name}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {s.project_name ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-navy-900 dark:text-slate-100">
                      {s.balance_qty.toLocaleString()} {s.unit_of_measure}
                    </td>
                    <td className="px-5 py-3 text-right text-navy-900 dark:text-slate-100">
                      PKR {s.balance_value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      )}

      {/* ---- Vendor Modal ---- */}
      <Modal
        open={vendorModalOpen}
        onClose={() => setVendorModalOpen(false)}
        title="New Vendor"
        description="Add a supplier for material purchases."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createVendor.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="vendor_name">Name</Label>
            <Input
              id="vendor_name"
              required
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="vendor_ntn">CNIC / NTN</Label>
              <Input
                id="vendor_ntn"
                value={vendorForm.ntn_cnic}
                onChange={(e) => setVendorForm({ ...vendorForm, ntn_cnic: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="vendor_phone">Phone</Label>
              <Input
                id="vendor_phone"
                value={vendorForm.phone}
                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="vendor_address">Address</Label>
            <Input
              id="vendor_address"
              value={vendorForm.address}
              onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setVendorModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createVendor.isPending}>
              Add Vendor
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Warehouse Modal ---- */}
      <Modal
        open={warehouseModalOpen}
        onClose={() => setWarehouseModalOpen(false)}
        title="New Warehouse"
        description="Add a physical storage location — material lands here via GRN and is issued out to sites from here."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createWarehouse.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="warehouse_name">Name</Label>
            <Input
              id="warehouse_name"
              required
              value={warehouseForm.name}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
              placeholder="e.g. Main Godown — Orangi Town"
            />
          </div>
          <div>
            <Label htmlFor="warehouse_location">Location</Label>
            <Input
              id="warehouse_location"
              value={warehouseForm.location}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
              placeholder="Address / area"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setWarehouseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createWarehouse.isPending}>
              Add Warehouse
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Material Modal ---- */}
      <Modal
        open={materialModalOpen}
        onClose={() => setMaterialModalOpen(false)}
        title="New Material"
        description="Add an item to the material catalog."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMaterial.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="material_name">Name</Label>
            <Input
              id="material_name"
              required
              value={materialForm.name}
              onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
              placeholder="e.g. Cement"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="material_uom">Unit of Measure</Label>
              <Input
                id="material_uom"
                required
                value={materialForm.unit_of_measure}
                onChange={(e) => setMaterialForm({ ...materialForm, unit_of_measure: e.target.value })}
                placeholder="e.g. Bag, Ton, Cft"
              />
            </div>
            <div>
              <Label htmlFor="material_category">Category</Label>
              <Input
                id="material_category"
                value={materialForm.category}
                onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setMaterialModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMaterial.isPending}>
              Add Material
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Material Purchase History Modal ---- */}
      <Modal
        open={!!historyMaterial}
        onClose={() => setHistoryMaterial(null)}
        title={historyMaterial ? `Purchase History — ${historyMaterial.name}` : "Purchase History"}
        description="Every GRN received against this material, vendor-wise."
        className="max-w-2xl"
      >
        {(() => {
          const rows = (grns ?? [])
            .flatMap((g) =>
              g.lines
                .filter((l) => l.material_id === historyMaterial?.id)
                .map((l) => ({ grn: g, line: l })),
            )
            .sort((a, b) => (a.grn.grn_date < b.grn.grn_date ? 1 : -1));

          if (rows.length === 0) {
            return (
              <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                No purchases recorded for this material yet.
              </p>
            );
          }

          const totalQty = rows.reduce((s, r) => s + Number(r.line.quantity), 0);
          const totalAmount = rows.reduce((s, r) => s + Number(r.line.amount), 0);

          return (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">GRN #</th>
                  <th className="px-3 py-2 font-medium">Vendor</th>
                  <th className="px-3 py-2 font-medium">Project</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {rows.map(({ grn, line }) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{grn.grn_date}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {grn.grn_no}
                    </td>
                    <td className="px-3 py-2 text-navy-900 dark:text-slate-100">{grn.vendor.name}</td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {grn.project?.project_name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-navy-900 dark:text-slate-100">
                      {Number(line.quantity).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-navy-900 dark:text-slate-100">
                      {Number(line.rate).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-navy-900 dark:text-slate-100">
                      {Number(line.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-navy-700 font-semibold text-navy-950 dark:text-white">
                  <td colSpan={4} className="px-3 py-2 text-right">
                    Total
                  </td>
                  <td className="px-3 py-2 text-right">{totalQty.toLocaleString()}</td>
                  <td />
                  <td className="px-3 py-2 text-right">PKR {totalAmount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          );
        })()}
      </Modal>

      {/* ---- Purchase Order Modal ---- */}
      <Modal
        open={poModalOpen}
        onClose={() => setPoModalOpen(false)}
        title="New Purchase Order"
        description="Plan a purchase against a vendor — optional before GRN."
        className="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPo.mutate();
          }}
          className="space-y-4"
        >
          {poError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{poError}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="po_vendor">Vendor</Label>
              <Select
                id="po_vendor"
                required
                value={poForm.vendor_id}
                onChange={(e) => setPoForm({ ...poForm, vendor_id: e.target.value })}
              >
                <option value="">Select vendor</option>
                {vendors?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="po_project">Project</Label>
              <Select
                id="po_project"
                value={poForm.project_id}
                onChange={(e) => setPoForm({ ...poForm, project_id: e.target.value })}
              >
                <option value="">— None —</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <LineItemsEditor lines={poLines} setLines={setPoLines} materials={materials} showRate />

          <div className="flex justify-end text-sm font-semibold text-navy-900 dark:text-slate-100">
            Total: PKR {poTotal.toLocaleString()}
          </div>

          <div>
            <Label htmlFor="po_narration">Narration</Label>
            <Input
              id="po_narration"
              value={poForm.narration}
              onChange={(e) => setPoForm({ ...poForm, narration: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPoModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPo.isPending}>
              Save Purchase Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- GRN Modal ---- */}
      <Modal
        open={grnModalOpen}
        onClose={() => setGrnModalOpen(false)}
        title="New GRN"
        description="Record material received — updates stock and posts an accounting entry."
        className="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createGrn.mutate();
          }}
          className="space-y-4"
        >
          {grnError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{grnError}</p>
          )}
          <div>
            <Label htmlFor="grn_po">Against Purchase Order (optional)</Label>
            <Select
              id="grn_po"
              value={grnForm.po_id}
              onChange={(e) => applyPoToGrn(e.target.value)}
            >
              <option value="">— No PO / direct purchase —</option>
              {receivablePos.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.po_no} — {po.vendor.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Selecting a PO fills in the vendor, project and line items below, and closes the PO once received.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="grn_vendor">Vendor</Label>
              <Select
                id="grn_vendor"
                required
                value={grnForm.vendor_id}
                onChange={(e) => setGrnForm({ ...grnForm, vendor_id: e.target.value })}
              >
                <option value="">Select vendor</option>
                {vendors?.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="grn_warehouse">Received Into</Label>
              <Select
                id="grn_warehouse"
                required
                value={grnForm.warehouse_id}
                onChange={(e) => setGrnForm({ ...grnForm, warehouse_id: e.target.value })}
              >
                <option value="">Select warehouse</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_code} — {w.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="grn_project">Project (optional)</Label>
            <Select
              id="grn_project"
              value={grnForm.project_id}
              onChange={(e) => setGrnForm({ ...grnForm, project_id: e.target.value })}
            >
              <option value="">— None —</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Just for reporting which project this purchase was for — stock lands in the warehouse above either way.
            </p>
          </div>

          <div>
            <Label htmlFor="grn_payment_account">Paid From / Payable Account</Label>
            <Select
              id="grn_payment_account"
              required
              value={grnForm.payment_account_id}
              onChange={(e) => setGrnForm({ ...grnForm, payment_account_id: e.target.value })}
            >
              <option value="">Select account</option>
              {paymentAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </Select>
          </div>

          <LineItemsEditor lines={grnLines} setLines={setGrnLines} materials={materials} showRate />

          <div className="flex justify-end text-sm font-semibold text-navy-900 dark:text-slate-100">
            Total: PKR {grnTotal.toLocaleString()}
          </div>

          <div>
            <Label htmlFor="grn_narration">Narration</Label>
            <Input
              id="grn_narration"
              value={grnForm.narration}
              onChange={(e) => setGrnForm({ ...grnForm, narration: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setGrnModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createGrn.isPending}>
              Save GRN
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Material Issue Modal ---- */}
      <Modal
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        title="New Material Issue"
        description="Issue material to a project/site — reduces stock at the current weighted-average rate."
        className="max-w-2xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createIssue.mutate();
          }}
          className="space-y-4"
        >
          {issueError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{issueError}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="issue_warehouse">From Warehouse</Label>
              <Select
                id="issue_warehouse"
                required
                value={issueForm.warehouse_id}
                onChange={(e) => setIssueForm({ ...issueForm, warehouse_id: e.target.value })}
              >
                <option value="">Select warehouse</option>
                {warehouses?.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_code} — {w.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="issue_project">Project / Site</Label>
              <Select
                id="issue_project"
                required
                value={issueForm.project_id}
                onChange={(e) => setIssueForm({ ...issueForm, project_id: e.target.value })}
              >
                <option value="">Select project</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="issue_reason">Reason</Label>
            <Select
              id="issue_reason"
              value={issueForm.reason}
              onChange={(e) =>
                setIssueForm({ ...issueForm, reason: e.target.value as MaterialIssueReason })
              }
            >
              <option value="Site Consumption">Site Consumption</option>
              <option value="Damaged / Wastage">Damaged / Wastage</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="issue_to">Issued To</Label>
            <Input
              id="issue_to"
              value={issueForm.issued_to}
              onChange={(e) => setIssueForm({ ...issueForm, issued_to: e.target.value })}
              placeholder={
                issueForm.reason === "Damaged / Wastage"
                  ? "e.g. Cement bags damaged during storage"
                  : "e.g. Site Engineer — Block A"
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Materials</Label>
            {issueLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  value={line.material_id}
                  onChange={(e) => {
                    const next = [...issueLines];
                    next[i] = { ...next[i], material_id: e.target.value };
                    setIssueLines(next);
                  }}
                  className="flex-1"
                >
                  <option value="">Select material</option>
                  {materials?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit_of_measure})
                    </option>
                  ))}
                </Select>
                <Input
                  type="number"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => {
                    const next = [...issueLines];
                    next[i] = { ...next[i], quantity: e.target.value };
                    setIssueLines(next);
                  }}
                  className="w-28"
                />
                <button
                  type="button"
                  onClick={() => setIssueLines(issueLines.filter((_, idx) => idx !== i))}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                  disabled={issueLines.length === 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIssueLines([...issueLines, { material_id: "", quantity: "" }])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line
            </Button>
          </div>

          <div>
            <Label htmlFor="issue_narration">Narration</Label>
            <Input
              id="issue_narration"
              value={issueForm.narration}
              onChange={(e) => setIssueForm({ ...issueForm, narration: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIssueModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createIssue.isPending}>
              Save Issue
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Resolve Damaged Issue Modal ---- */}
      <Modal
        open={!!resolveIssue}
        onClose={() => {
          setResolveIssue(null);
          setResolutionNote("");
          setResolveRestock(false);
          setResolveError(null);
        }}
        title={resolveIssue ? `Resolve ${resolveIssue.issue_no}` : "Resolve"}
        description="Record how the vendor made good on this reported damage/wastage — replacement, refund, credit note, etc."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            resolveMutation.mutate();
          }}
          className="space-y-4"
        >
          {resolveError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{resolveError}</p>
          )}
          <div>
            <Label htmlFor="resolution_note">Resolution</Label>
            <Input
              id="resolution_note"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="e.g. Vendor replaced 7 bags free of cost"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-navy-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={resolveRestock}
              onChange={(e) => setResolveRestock(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              Vendor sent replacement material — add the original quantity back into stock
              {resolveIssue && (
                <span className="block text-xs text-slate-400 dark:text-slate-500">
                  {resolveIssue.lines.map((l) => `${l.material.name} +${l.quantity}`).join(", ")}
                </span>
              )}
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setResolveIssue(null);
                setResolutionNote("");
                setResolveRestock(false);
                setResolveError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={resolveMutation.isPending}>
              Mark Resolved
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Mark Received Modal ---- */}
      <Modal
        open={!!receiveIssue}
        onClose={() => {
          setReceiveIssue(null);
          setReceivedByInput("");
          setReceiveError(null);
        }}
        title={receiveIssue ? `Confirm receipt — ${receiveIssue.issue_no}` : "Confirm receipt"}
        description="Record that this delivery has arrived at site."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            receiveMutation.mutate();
          }}
          className="space-y-4"
        >
          {receiveError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{receiveError}</p>
          )}
          <div>
            <Label htmlFor="received_by">Received by</Label>
            <Input
              id="received_by"
              required
              value={receivedByInput}
              onChange={(e) => setReceivedByInput(e.target.value)}
              placeholder="Name of the person confirming receipt"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setReceiveIssue(null);
                setReceivedByInput("");
                setReceiveError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={receiveMutation.isPending}>
              Confirm Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Warehouse Dispatch QR Modal ---- */}
      <Modal
        open={!!qrWarehouse}
        onClose={() => setQrWarehouse(null)}
        title={qrWarehouse ? `Dispatch QR — ${qrWarehouse.name}` : "Dispatch QR"}
        description="Print and stick this at the warehouse gate. Scanning it opens a form to log what's leaving — no need to create the issue from the office first."
      >
        {qrWarehouse && (
          <div className="space-y-4 text-center">
            <QrImage url={`${window.location.origin}/warehouses/${qrWarehouse.id}/dispatch`} />
            <Button variant="secondary" className="w-full" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function LineItemsEditor({
  lines,
  setLines,
  materials,
  showRate,
}: {
  lines: QtyRateLine[];
  setLines: (lines: QtyRateLine[]) => void;
  materials: Material[] | undefined;
  showRate: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Materials</Label>
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          <Select
            value={line.material_id}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...next[i], material_id: e.target.value };
              setLines(next);
            }}
            className="flex-1"
          >
            <option value="">Select material</option>
            {materials?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.unit_of_measure})
              </option>
            ))}
          </Select>
          <Input
            type="number"
            placeholder="Qty"
            value={line.quantity}
            onChange={(e) => {
              const next = [...lines];
              next[i] = { ...next[i], quantity: e.target.value };
              setLines(next);
            }}
            className="w-24"
          />
          {showRate && (
            <Input
              type="number"
              placeholder="Rate"
              value={line.rate}
              onChange={(e) => {
                const next = [...lines];
                next[i] = { ...next[i], rate: e.target.value };
                setLines(next);
              }}
              className="w-28"
            />
          )}
          <button
            type="button"
            onClick={() => setLines(lines.filter((_, idx) => idx !== i))}
            className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
            disabled={lines.length === 1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => setLines([...lines, emptyLine()])}>
        <Plus className="h-3.5 w-3.5" />
        Add Line
      </Button>
    </div>
  );
}
