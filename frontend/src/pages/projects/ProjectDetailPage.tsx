import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  LayoutGrid,
  Layers,
  List,
  Pencil,
  Plus,
  Sparkles,
  Tags,
  Trash2,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ProjectStatusBadge, UnitStatusBadge } from "../../components/ui/Badge";
import { UnitAvailabilityGrid } from "../../components/units/UnitAvailabilityGrid";
import { toast, apiErrorMessage } from "../../lib/toast";
import { confirm } from "../../lib/confirm";
import type {
  Partner,
  PaymentTemplate,
  ProjectDetail,
  ProjectFloor,
  ProjectPartnerShare,
  ScheduleFrequency,
  Unit,
  UnitCategory,
  UnitStatus,
} from "../../types";

type Tab = "overview" | "floors" | "units" | "partners" | "payment-plan";
type UnitView = "grid" | "table";

function floorNumberLabel(floorNo: string): string | null {
  const lower = floorNo.toLowerCase();
  if (lower.includes("lower ground")) return "LG";
  if (lower.includes("ground")) return "0";
  const match = lower.match(/\d+/);
  return match ? match[0] : null;
}

function ordinalFloorLabel(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th Floor`;
  switch (n % 10) {
    case 1:
      return `${n}st Floor`;
    case 2:
      return `${n}nd Floor`;
    case 3:
      return `${n}rd Floor`;
    default:
      return `${n}th Floor`;
  }
}

const templateFrequencies: ScheduleFrequency[] = ["Monthly", "Quarterly", "Half-Yearly", "Yearly"];

type TemplateLineForm = {
  label: string;
  frequency: ScheduleFrequency;
  no_of_installments: string;
  percent: string;
  months_after_booking: string;
};

const emptyTemplateLine = (): TemplateLineForm => ({
  label: "Monthly Installments",
  frequency: "Monthly",
  no_of_installments: "",
  percent: "",
  months_after_booking: "0",
});

export default function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const [tab, setTab] = React.useState<Tab>("overview");

  const [floorModalOpen, setFloorModalOpen] = React.useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [generateModalOpen, setGenerateModalOpen] = React.useState(false);
  const [unitView, setUnitView] = React.useState<UnitView>("grid");
  const [selectedUnit, setSelectedUnit] = React.useState<Unit | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
  });

  const { data: units } = useQuery({
    queryKey: ["units", projectId],
    queryFn: async () =>
      (await api.get<Unit[]>("/units/", { params: { project_id: projectId } })).data,
    enabled: !!projectId,
  });

  const { data: categories } = useQuery({
    queryKey: ["unit-categories"],
    queryFn: async () => (await api.get<UnitCategory[]>("/unit-categories/")).data,
  });

  // Payment plan template — the project's standard schedule (booking %,
  // then a milestone/installment breakdown of the rest), pulled in to
  // prefill a new booking instead of typing the same plan out every time.
  const { data: paymentTemplate } = useQuery({
    queryKey: ["payment-template", projectId],
    queryFn: async () =>
      (await api.get<PaymentTemplate | null>(`/projects/${projectId}/payment-template`)).data,
    enabled: !!projectId,
  });

  const [templateForm, setTemplateForm] = React.useState<{
    booking_percent: string;
    lines: TemplateLineForm[];
  }>({ booking_percent: "", lines: [] });
  const [templateError, setTemplateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (paymentTemplate) {
      setTemplateForm({
        booking_percent: String(paymentTemplate.booking_percent),
        lines: paymentTemplate.lines.map((l) => ({
          label: l.label,
          frequency: l.frequency,
          no_of_installments: String(l.no_of_installments),
          percent: String(l.percent),
          months_after_booking: String(l.months_after_booking),
        })),
      });
    }
  }, [paymentTemplate]);

  const addTemplateLine = () =>
    setTemplateForm((f) => ({ ...f, lines: [...f.lines, emptyTemplateLine()] }));
  const removeTemplateLine = (idx: number) =>
    setTemplateForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }));
  const updateTemplateLine = (idx: number, patch: Partial<TemplateLineForm>) =>
    setTemplateForm((f) => ({
      ...f,
      lines: f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));

  const templateTotalPercent =
    (Number(templateForm.booking_percent) || 0) +
    templateForm.lines.reduce((s, l) => s + (Number(l.percent) || 0), 0);

  const saveTemplate = useMutation({
    mutationFn: async () =>
      (
        await api.put<PaymentTemplate>(`/projects/${projectId}/payment-template`, {
          booking_percent: Number(templateForm.booking_percent) || 0,
          lines: templateForm.lines.map((l) => ({
            label: l.label || "Installments",
            frequency: l.frequency,
            no_of_installments: Number(l.no_of_installments) || 0,
            percent: Number(l.percent) || 0,
            months_after_booking: Number(l.months_after_booking) || 0,
          })),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-template", projectId] });
      setTemplateError(null);
      toast.success("Payment plan template saved.");
    },
    onError: (err: unknown) =>
      setTemplateError(apiErrorMessage(err, "Failed to save payment plan template.")),
  });

  // Total budget
  const [budgetModalOpen, setBudgetModalOpen] = React.useState(false);
  const [budgetDraft, setBudgetDraft] = React.useState("");
  const updateBudget = useMutation({
    mutationFn: async () =>
      (
        await api.put(`/projects/${projectId}`, {
          total_budget: budgetDraft ? Number(budgetDraft) : null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setBudgetModalOpen(false);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update budget.")),
  });

  // Total floors (must be set before floors/units can be added)
  const [totalFloorsDraft, setTotalFloorsDraft] = React.useState("");
  const setTotalFloors = useMutation({
    mutationFn: async () =>
      (
        await api.put(`/projects/${projectId}`, {
          total_floors: Number(totalFloorsDraft),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });

  // Floor form
  const [floorForm, setFloorForm] = React.useState({ block: "", floor_no: "", no_of_units: "" });
  // Floor numbers already added for the block currently typed into the form —
  // used to stop the same floor being picked twice for one block.
  const takenFloorNos = React.useMemo(() => {
    const normalizedBlock = floorForm.block.trim().toLowerCase();
    return new Set(
      (project?.floors ?? [])
        .filter((f) => (f.block ?? "").trim().toLowerCase() === normalizedBlock)
        .map((f) => f.floor_no)
    );
  }, [project?.floors, floorForm.block]);
  React.useEffect(() => {
    if (floorForm.floor_no && takenFloorNos.has(floorForm.floor_no)) {
      setFloorForm((f) => ({ ...f, floor_no: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takenFloorNos]);
  const createFloor = useMutation({
    mutationFn: async () =>
      (
        await api.post<ProjectFloor>(`/projects/${projectId}/floors`, {
          block: floorForm.block || null,
          floor_no: floorForm.floor_no,
          no_of_units: Number(floorForm.no_of_units || 0),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      setFloorModalOpen(false);
      setFloorForm({ block: "", floor_no: "", no_of_units: "" });
    },
  });

  const deleteFloor = useMutation({
    mutationFn: async (floorId: number) => api.delete(`/projects/floors/${floorId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete floor."));
    },
  });

  // Category form
  const [categoryForm, setCategoryForm] = React.useState({ name: "", base_price: "" });
  const [editingCategoryId, setEditingCategoryId] = React.useState<number | null>(null);
  const [categoryError, setCategoryError] = React.useState<string | null>(null);

  const resetCategoryForm = () => {
    setCategoryForm({ name: "", base_price: "" });
    setEditingCategoryId(null);
    setCategoryError(null);
  };

  const startEditCategory = (c: UnitCategory) => {
    setEditingCategoryId(c.id);
    setCategoryForm({ name: c.name, base_price: c.base_price ? String(c.base_price) : "" });
    setCategoryError(null);
  };

  const categoryMutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-categories"] });
      resetCategoryForm();
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCategoryError(message ?? "Failed to save category.");
    },
  };

  const createCategory = useMutation({
    mutationFn: async () =>
      (
        await api.post<UnitCategory>("/unit-categories/", {
          name: categoryForm.name,
          base_price: categoryForm.base_price ? Number(categoryForm.base_price) : 0,
        })
      ).data,
    ...categoryMutationOptions,
  });

  const updateCategory = useMutation({
    mutationFn: async () =>
      (
        await api.put<UnitCategory>(`/unit-categories/${editingCategoryId}`, {
          name: categoryForm.name,
          base_price: categoryForm.base_price ? Number(categoryForm.base_price) : 0,
        })
      ).data,
    ...categoryMutationOptions,
  });

  const deleteCategory = useMutation({
    mutationFn: async (categoryId: number) => api.delete(`/unit-categories/${categoryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unit-categories"] });
      if (editingCategoryId) resetCategoryForm();
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete category."));
    },
  });

  // Bulk generate units — one floor can mix categories in a single go, e.g.
  // 2x "2 Bed" + 1x "3 Bed" on a 3-unit floor, via one row per category.
  type GenRow = { unit_category_id: string; quantity: string; base_price: string };
  const emptyGenRow: GenRow = { unit_category_id: "", quantity: "", base_price: "" };
  const [genForm, setGenForm] = React.useState<{ floor_id: string; prefix: string; rows: GenRow[] }>({
    floor_id: "",
    prefix: "",
    rows: [emptyGenRow],
  });
  const genFloor = project?.floors.find((f) => f.id === Number(genForm.floor_id));
  const genFloorGeneratedCount = genFloor
    ? (units ?? []).filter((u) => u.floor_id === genFloor.id).length
    : 0;
  const genFloorRemaining = genFloor ? genFloor.no_of_units - genFloorGeneratedCount : 0;
  const genRowsTotal = genForm.rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  React.useEffect(() => {
    if (genFloor) {
      const floorLabel = floorNumberLabel(genFloor.floor_no);
      const joined = [genFloor.block, floorLabel].filter(Boolean).join("-");
      const suggestedPrefix = joined ? `${joined}-` : "";
      setGenForm((f) => ({
        ...f,
        prefix: suggestedPrefix,
        rows: [{ unit_category_id: "", quantity: String(genFloorRemaining), base_price: "" }],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genForm.floor_id]);

  const updateGenRow = (index: number, patch: Partial<GenRow>) =>
    setGenForm((f) => ({ ...f, rows: f.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));

  const addGenRow = () =>
    setGenForm((f) => ({
      ...f,
      rows: [
        ...f.rows,
        { unit_category_id: "", quantity: String(Math.max(genFloorRemaining - genRowsTotal, 0)), base_price: "" },
      ],
    }));

  const removeGenRow = (index: number) =>
    setGenForm((f) => ({ ...f, rows: f.rows.filter((_, i) => i !== index) }));

  const generateUnits = useMutation({
    mutationFn: async () => {
      const prefix = genForm.prefix.trim();
      const results: Unit[] = [];
      // Sequential, not parallel — each batch's numbering picks up from
      // however many units the previous batch just created on this floor.
      for (const row of genForm.rows) {
        const quantity = Number(row.quantity) || 0;
        if (quantity <= 0) continue;
        const created = (
          await api.post<Unit[]>(`/units/bulk-generate/${projectId}`, {
            floor_id: Number(genForm.floor_id),
            unit_category_id: row.unit_category_id ? Number(row.unit_category_id) : null,
            quantity,
            prefix,
            base_price: Number(row.base_price) || 0,
          })
        ).data;
        results.push(...created);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units", projectId] });
      setGenerateModalOpen(false);
      setGenForm({ floor_id: "", prefix: "", rows: [emptyGenRow] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to generate units."));
      queryClient.invalidateQueries({ queryKey: ["units", projectId] });
    },
  });

  const updateUnitStatus = useMutation({
    mutationFn: async ({ unitId, status }: { unitId: number; status: UnitStatus }) =>
      api.put(`/units/${unitId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["units", projectId] }),
  });

  const [unitNumberDraft, setUnitNumberDraft] = React.useState("");
  const updateUnitNumber = useMutation({
    mutationFn: async ({ unitId, unit_number }: { unitId: number; unit_number: string }) =>
      api.put(`/units/${unitId}`, { unit_number }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units", projectId] });
      toast.success("Unit number updated.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update unit number.")),
  });

  const [basePriceDraft, setBasePriceDraft] = React.useState("");
  const updateUnitPrice = useMutation({
    mutationFn: async ({ unitId, base_price }: { unitId: number; base_price: number }) =>
      api.put(`/units/${unitId}`, { base_price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units", projectId] });
      toast.success("Unit price updated.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update unit price.")),
  });

  const deleteUnit = useMutation({
    mutationFn: async (unitId: number) => api.delete(`/units/${unitId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units", projectId] });
      setSelectedUnit(null);
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete unit."));
    },
  });

  // Partner shares
  const { data: shares } = useQuery({
    queryKey: ["project-partner-shares", projectId],
    queryFn: async () =>
      (await api.get<ProjectPartnerShare[]>(`/projects/${projectId}/partner-shares`)).data,
    enabled: !!projectId,
  });

  const { data: allPartners } = useQuery({
    queryKey: ["partners"],
    queryFn: async () => (await api.get<Partner[]>("/partners/")).data,
  });

  const [shareModalOpen, setShareModalOpen] = React.useState(false);
  const [shareForm, setShareForm] = React.useState({ partner_id: "", investment_amount: "", share_percent: "" });
  const [shareError, setShareError] = React.useState<string | null>(null);

  const totalSharePercent = shares?.reduce((s, sh) => s + Number(sh.share_percent), 0) ?? 0;

  const addShare = useMutation({
    mutationFn: async () =>
      (
        await api.post<ProjectPartnerShare>(`/projects/${projectId}/partner-shares`, {
          partner_id: Number(shareForm.partner_id),
          investment_amount: shareForm.investment_amount ? Number(shareForm.investment_amount) : 0,
          share_percent: Number(shareForm.share_percent),
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-partner-shares", projectId] });
      setShareModalOpen(false);
      setShareForm({ partner_id: "", investment_amount: "", share_percent: "" });
      setShareError(null);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setShareError(message ?? "Failed to add share");
    },
  });

  const deleteShare = useMutation({
    mutationFn: async (shareId: number) => api.delete(`/projects/partner-shares/${shareId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-partner-shares", projectId] }),
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to remove share."));
    },
  });

  const currentSelectedUnit = selectedUnit
    ? units?.find((u) => u.id === selectedUnit.id) ?? selectedUnit
    : null;

  React.useEffect(() => {
    setUnitNumberDraft(currentSelectedUnit?.unit_number ?? "");
  }, [currentSelectedUnit?.id, currentSelectedUnit?.unit_number]);

  React.useEffect(() => {
    setBasePriceDraft(currentSelectedUnit ? String(currentSelectedUnit.base_price) : "");
  }, [currentSelectedUnit?.id, currentSelectedUnit?.base_price]);

  if (!project) {
    return <div className="text-sm text-slate-400 dark:text-slate-500">Loading project...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Projects
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-navy-950 dark:text-white">{project.project_name}</h2>
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {project.project_code} {project.address ? `· ${project.address}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Budget</p>
              <button
                onClick={() => {
                  setBudgetDraft(project.total_budget ? String(project.total_budget) : "");
                  setBudgetModalOpen(true);
                }}
                className="rounded-md p-1 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                title="Edit total budget"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">
              {project.total_budget ? `PKR ${Number(project.total_budget).toLocaleString()}` : "—"}
            </p>
            {project.total_budget ? (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Spent PKR {project.total_spent.toLocaleString()} ·{" "}
                <span
                  className={
                    project.total_budget - project.total_spent < 0
                      ? "font-medium text-danger-500"
                      : "font-medium"
                  }
                >
                  {project.total_budget - project.total_spent < 0 ? "Over by" : "Remaining"} PKR{" "}
                  {Math.abs(project.total_budget - project.total_spent).toLocaleString()}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Spent so far: PKR {project.total_spent.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-slate-500 dark:text-slate-400">Floors / Blocks</p>
            <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">
              {project.floors.length}
              {project.total_floors ? ` / ${project.total_floors}` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Units</p>
            <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">{units?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-navy-700">
        {(["overview", "floors", "units", "partners", "payment-plan"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
            }`}
          >
            {t === "floors" ? "Floors / Blocks" : t === "payment-plan" ? "Payment Plan" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Project Group</p>
              <p className="mt-0.5 text-navy-900 dark:text-slate-100">{project.project_group?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Commission %</p>
              <p className="mt-0.5 text-navy-900 dark:text-slate-100">{project.commission_percent ?? 0}%</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Address</p>
              <p className="mt-0.5 text-navy-900 dark:text-slate-100">{project.address || "—"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "floors" && (
        <Card>
          <CardHeader>
            <CardTitle>Floors / Blocks</CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setTotalFloorsDraft(project.total_floors ? String(project.total_floors) : "");
                setFloorModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Floor
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Block</th>
                  <th className="px-5 py-3 font-medium">Floor No.</th>
                  <th className="px-5 py-3 font-medium">No. of Units</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {project.floors.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                      No floors defined yet.
                    </td>
                  </tr>
                )}
                {project.floors.map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{f.block || "—"}</td>
                    <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{f.floor_no}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{f.no_of_units}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => deleteFloor.mutate(f.id)}
                        className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {tab === "units" && (
        <Card>
          <CardHeader>
            <CardTitle>Units</CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 dark:border-navy-700 p-0.5">
                <button
                  onClick={() => setUnitView("grid")}
                  title="Grid view"
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    unitView === "grid" ? "bg-brand-600 text-white" : "text-slate-400 dark:text-slate-500 hover:text-navy-700 dark:text-slate-300"
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setUnitView("table")}
                  title="Table view"
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                    unitView === "table" ? "bg-brand-600 text-white" : "text-slate-400 dark:text-slate-500 hover:text-navy-700 dark:text-slate-300"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setCategoryModalOpen(true)}>
                <Tags className="h-4 w-4" />
                Manage Categories
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setGenForm({ floor_id: "", prefix: "", rows: [emptyGenRow] });
                  setGenerateModalOpen(true);
                }}
              >
                <Sparkles className="h-4 w-4" />
                Generate Units
              </Button>
            </div>
          </CardHeader>

          {unitView === "grid" ? (
            <CardContent>
              <UnitAvailabilityGrid
                floors={project.floors}
                units={units ?? []}
                onSelectUnit={setSelectedUnit}
              />
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Ref No.</th>
                    <th className="px-5 py-3 font-medium">Unit #</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">Total Price</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                  {(!units || units.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                        No units yet. Define a floor, then click "Generate Units".
                      </td>
                    </tr>
                  )}
                  {units?.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                      <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{u.unit_ref_no}</td>
                      <td className="px-5 py-3 font-medium text-navy-900 dark:text-slate-100">{u.unit_number}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{u.unit_category?.name ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                        PKR {Number(u.total_price).toLocaleString()}
                      </td>
                      <td className="px-5 py-3">
                        <Select
                          value={u.status}
                          onChange={(e) =>
                            updateUnitStatus.mutate({
                              unitId: u.id,
                              status: e.target.value as UnitStatus,
                            })
                          }
                          className="h-8 w-36 text-xs"
                        >
                          {(["Available", "Booked", "Sold", "On-Hold", "Cancelled"] as UnitStatus[]).map(
                            (s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ),
                          )}
                        </Select>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={async () => {
                            const ok = await confirm(`Delete unit "${u.unit_number}"?`, {
                              danger: true,
                              confirmLabel: "Delete",
                            });
                            if (ok) deleteUnit.mutate(u.id);
                          }}
                          title="Delete unit"
                          className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          )}
        </Card>
      )}

      {tab === "partners" && (
        <Card>
          <CardHeader>
            <CardTitle>Partners / Investors</CardTitle>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-medium ${
                  totalSharePercent > 100 ? "text-danger-600" : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {totalSharePercent}% allocated
              </span>
              <Button size="sm" onClick={() => setShareModalOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Partner
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Partner</th>
                  <th className="px-5 py-3 font-medium">Investment</th>
                  <th className="px-5 py-3 font-medium">Share %</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {shares?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                      No partners configured for this project yet.
                    </td>
                  </tr>
                )}
                {shares?.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                    <td className="px-5 py-3 font-medium text-navy-900 dark:text-slate-100">{s.partner.name}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {s.investment_amount ? `PKR ${Number(s.investment_amount).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{s.share_percent}%</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={async () => {
                          const ok = await confirm(`Remove ${s.partner.name}'s share from this project?`, {
                            danger: true,
                            confirmLabel: "Remove",
                          });
                          if (ok) deleteShare.mutate(s.id);
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
          </CardContent>
        </Card>
      )}

      {tab === "payment-plan" && (
        <Card>
          <CardHeader>
            <CardTitle>Standard Payment Plan</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Defined as percentages of a unit's price, so the same plan applies whichever unit gets
              booked — pulled in via "Use Standard Schedule" on New Booking.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {templateError && (
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{templateError}</p>
            )}

            <div className="w-48">
              <Label htmlFor="tpl_booking_percent">Booking %</Label>
              <Input
                id="tpl_booking_percent"
                type="number"
                step="0.01"
                value={templateForm.booking_percent}
                onChange={(e) => setTemplateForm({ ...templateForm, booking_percent: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              {templateForm.lines.map((line, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 p-3 dark:border-navy-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Line {idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTemplateLine(idx)}
                      className="rounded-md p-1 text-slate-400 hover:bg-danger-50 hover:text-danger-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`tpl_label_${idx}`}>Label</Label>
                      <Input
                        id={`tpl_label_${idx}`}
                        value={line.label}
                        onChange={(e) => updateTemplateLine(idx, { label: e.target.value })}
                        placeholder="e.g. Allocation, Monthly Installments"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`tpl_frequency_${idx}`}>Frequency</Label>
                      <Select
                        id={`tpl_frequency_${idx}`}
                        value={line.frequency}
                        onChange={(e) =>
                          updateTemplateLine(idx, { frequency: e.target.value as ScheduleFrequency })
                        }
                      >
                        {templateFrequencies.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor={`tpl_count_${idx}`}>No. of Installments</Label>
                      <Input
                        id={`tpl_count_${idx}`}
                        type="number"
                        value={line.no_of_installments}
                        onChange={(e) => updateTemplateLine(idx, { no_of_installments: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`tpl_percent_${idx}`}>Percent</Label>
                      <Input
                        id={`tpl_percent_${idx}`}
                        type="number"
                        step="0.01"
                        value={line.percent}
                        onChange={(e) => updateTemplateLine(idx, { percent: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`tpl_months_${idx}`}>Starts (months after booking)</Label>
                      <Input
                        id={`tpl_months_${idx}`}
                        type="number"
                        value={line.months_after_booking}
                        onChange={(e) => updateTemplateLine(idx, { months_after_booking: e.target.value })}
                      />
                    </div>
                  </div>
                  {Number(line.no_of_installments) === 1 && (
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      A single installment works as a one-off milestone payment (e.g. "Allocation").
                    </p>
                  )}
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addTemplateLine}>
                <Plus className="h-3.5 w-3.5" />
                Add Line
              </Button>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
              <span>
                Total: <span className="font-semibold">{templateTotalPercent.toFixed(2)}%</span>
              </span>
              {templateTotalPercent !== 100 && (
                <span className="font-semibold text-danger-700">Must add up to 100%</span>
              )}
              <Button
                size="sm"
                disabled={saveTemplate.isPending || templateTotalPercent !== 100}
                onClick={() => saveTemplate.mutate()}
              >
                Save Payment Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Total Budget Modal */}
      <Modal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        title="Edit Total Budget"
        description="Update the overall budget for this project."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateBudget.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="project_budget">Total Budget (PKR)</Label>
            <Input
              id="project_budget"
              type="number"
              step="0.01"
              min="0"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              placeholder="Leave blank to clear budget"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setBudgetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateBudget.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Partner Share Modal */}
      <Modal
        open={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setShareError(null);
        }}
        title="Add Partner Share"
        description="Assign a business partner's ownership share for this project."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setShareError(null);
            addShare.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="share_partner">Partner</Label>
            <Select
              id="share_partner"
              required
              value={shareForm.partner_id}
              onChange={(e) => setShareForm({ ...shareForm, partner_id: e.target.value })}
            >
              <option value="">Select partner</option>
              {allPartners?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="share_investment">Investment Amount</Label>
              <Input
                id="share_investment"
                type="number"
                value={shareForm.investment_amount}
                onChange={(e) => setShareForm({ ...shareForm, investment_amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="share_percent">Share %</Label>
              <Input
                id="share_percent"
                type="number"
                step="0.01"
                required
                value={shareForm.share_percent}
                onChange={(e) => setShareForm({ ...shareForm, share_percent: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Currently allocated: {totalSharePercent}% · Remaining: {Math.max(0, 100 - totalSharePercent)}%
          </p>
          {shareError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{shareError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShareModalOpen(false);
                setShareError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={addShare.isPending}>
              Add Share
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Floor Modal */}
      <Modal
        open={floorModalOpen}
        onClose={() => setFloorModalOpen(false)}
        title="Add Floor / Block"
        description="Set how many floors this project has, then add each floor and its units."
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const draftCount = Number(totalFloorsDraft || 0);
            if (draftCount !== (project.total_floors ?? 0)) {
              await setTotalFloors.mutateAsync();
            }
            createFloor.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="total_floors_draft">Total Floors in this Project</Label>
            <Input
              id="total_floors_draft"
              type="number"
              min="1"
              required
              value={totalFloorsDraft}
              onChange={(e) => setTotalFloorsDraft(e.target.value)}
              placeholder="e.g. 5"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Enter this first — it determines which floor numbers you can pick below.
            </p>
          </div>

          <div>
            <Label htmlFor="block">Block (optional)</Label>
            <Input
              id="block"
              value={floorForm.block}
              onChange={(e) => setFloorForm({ ...floorForm, block: e.target.value })}
              placeholder="e.g. Block A"
            />
          </div>

          <div>
            <Label htmlFor="floor_no">Floor No.</Label>
            <Select
              id="floor_no"
              required
              disabled={!Number(totalFloorsDraft)}
              value={floorForm.floor_no}
              onChange={(e) => setFloorForm({ ...floorForm, floor_no: e.target.value })}
            >
              <option value="">
                {Number(totalFloorsDraft) ? "Select floor" : "Enter total floors first"}
              </option>
              <option value="Lower Ground" disabled={takenFloorNos.has("Lower Ground")}>
                Lower Ground Floor{takenFloorNos.has("Lower Ground") ? " (already added)" : ""}
              </option>
              <option value="Ground" disabled={takenFloorNos.has("Ground")}>
                Ground Floor{takenFloorNos.has("Ground") ? " (already added)" : ""}
              </option>
              {Array.from({ length: Number(totalFloorsDraft) || 0 }, (_, i) => i + 1)
                .map((n) => ordinalFloorLabel(n))
                .map((label) => (
                  <option key={label} value={label} disabled={takenFloorNos.has(label)}>
                    {label}{takenFloorNos.has(label) ? " (already added)" : ""}
                  </option>
                ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="no_of_units">No. of Units on this Floor</Label>
            <Input
              id="no_of_units"
              type="number"
              required
              disabled={!Number(totalFloorsDraft)}
              value={floorForm.no_of_units}
              onChange={(e) => setFloorForm({ ...floorForm, no_of_units: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setFloorModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createFloor.isPending || setTotalFloors.isPending || !Number(totalFloorsDraft)}
            >
              Add Floor
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Categories Modal */}
      <Modal
        open={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          resetCategoryForm();
        }}
        title="Unit Categories"
        description="Master list of unit sizes/types, shared across all projects."
      >
        <div className="space-y-4">
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {categories?.length === 0 && (
              <li className="text-sm text-slate-400 dark:text-slate-500">No categories yet.</li>
            )}
            {categories?.map((c) => (
              <li
                key={c.id}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  editingCategoryId === c.id
                    ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20"
                    : "border-slate-100 dark:border-navy-800"
                }`}
              >
                <span className="font-medium text-navy-900 dark:text-slate-100">{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    {c.base_price ? `PKR ${Number(c.base_price).toLocaleString()}` : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEditCategory(c)}
                    title="Edit category"
                    className="rounded-md p-1 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm(`Delete category "${c.name}"?`, {
                        danger: true,
                        confirmLabel: "Delete",
                      });
                      if (ok) deleteCategory.mutate(c.id);
                    }}
                    title="Delete category"
                    className="rounded-md p-1 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {categoryError && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">{categoryError}</p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingCategoryId) {
                updateCategory.mutate();
              } else {
                createCategory.mutate();
              }
            }}
            className="flex items-end gap-2 border-t border-slate-100 dark:border-navy-800 pt-4"
          >
            <div className="flex-1">
              <Label htmlFor="cat_name">Category Name</Label>
              <Input
                id="cat_name"
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g. 2-Bed Apartment"
              />
            </div>
            <div className="w-32">
              <Label htmlFor="cat_price">Base Price</Label>
              <Input
                id="cat_price"
                type="number"
                value={categoryForm.base_price}
                onChange={(e) => setCategoryForm({ ...categoryForm, base_price: e.target.value })}
              />
            </div>
            {editingCategoryId && (
              <Button type="button" variant="secondary" size="md" onClick={resetCategoryForm}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              size="md"
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              {editingCategoryId ? "Update" : "Add"}
            </Button>
          </form>
        </div>
      </Modal>

      {/* Generate Units Modal */}
      <Modal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Generate Units"
        description="Auto-generate a grid of units for a selected floor."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generateUnits.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="gen_floor">Floor</Label>
            <Select
              id="gen_floor"
              required
              value={genForm.floor_id}
              onChange={(e) => setGenForm({ ...genForm, floor_id: e.target.value })}
            >
              <option value="">Select floor</option>
              {project.floors.map((f) => {
                const generatedCount = (units ?? []).filter((u) => u.floor_id === f.id).length;
                const full = generatedCount >= f.no_of_units;
                return (
                  <option key={f.id} value={f.id} disabled={full}>
                    {f.block ? `${f.block} · ` : ""}
                    {f.floor_no} ({generatedCount} of {f.no_of_units} generated)
                    {full ? " — full" : ""}
                  </option>
                );
              })}
            </Select>
          </div>

          <div>
            <Label htmlFor="gen_prefix">Unit Number Prefix</Label>
            <Input
              id="gen_prefix"
              disabled={!genForm.floor_id}
              value={genForm.prefix}
              onChange={(e) => setGenForm({ ...genForm, prefix: e.target.value })}
              placeholder="e.g. A-10 for A-101, A-102..."
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Generated unit numbers will be this prefix followed by a running number — edit it to get
              whatever format you want (e.g. "A-10" → A-101, A-102...).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="!mb-0">Categories &amp; Quantities</Label>
              {genForm.floor_id && (
                <span
                  className={`text-xs ${
                    genRowsTotal > genFloorRemaining
                      ? "text-danger-500"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {genRowsTotal} of {genFloorRemaining} slot(s) assigned
                </span>
              )}
            </div>
            {genForm.rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  aria-label="Unit category"
                  disabled={!genForm.floor_id}
                  value={row.unit_category_id}
                  onChange={(e) => {
                    const category = categories?.find((c) => c.id === Number(e.target.value));
                    updateGenRow(i, {
                      unit_category_id: e.target.value,
                      // Suggest the category's price as a starting point — still
                      // editable per project/floor, only pre-filled when blank so
                      // it doesn't clobber a price the user already typed in.
                      base_price:
                        row.base_price || (category?.base_price ? String(category.base_price) : ""),
                    });
                  }}
                  className="flex-1"
                >
                  <option value="">— None —</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Input
                  aria-label="Quantity"
                  type="number"
                  min="1"
                  required
                  disabled={!genForm.floor_id}
                  value={row.quantity}
                  onChange={(e) => updateGenRow(i, { quantity: e.target.value })}
                  className="w-20"
                />
                <Input
                  aria-label="Price for this project"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price"
                  disabled={!genForm.floor_id}
                  value={row.base_price}
                  onChange={(e) => updateGenRow(i, { base_price: e.target.value })}
                  className="w-32"
                />
                <button
                  type="button"
                  onClick={() => removeGenRow(i)}
                  disabled={genForm.rows.length <= 1}
                  className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!genForm.floor_id || genRowsTotal >= genFloorRemaining}
              onClick={addGenRow}
            >
              <Plus className="h-3.5 w-3.5" />
              Add another category
            </Button>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Layers className="h-3.5 w-3.5" />
            {genForm.floor_id
              ? `Mix categories on this floor by giving each its own row — e.g. 2x "2 Bed" + ` +
                `1x "3 Bed" — they're numbered on in the order listed here. Price is pre-filled from ` +
                `the category but editable per project — the category itself stays shared/unchanged.`
              : "Units are created using each row's price, numbered from wherever this floor already has."}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setGenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                generateUnits.isPending ||
                !genForm.floor_id ||
                genRowsTotal <= 0 ||
                genRowsTotal > genFloorRemaining
              }
            >
              Generate
            </Button>
          </div>
        </form>
      </Modal>

      {/* Unit Detail Modal (from grid click) */}
      <Modal
        open={!!currentSelectedUnit}
        onClose={() => setSelectedUnit(null)}
        title={currentSelectedUnit ? `Unit ${currentSelectedUnit.unit_number}` : ""}
        description={currentSelectedUnit?.unit_ref_no}
      >
        {currentSelectedUnit && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="unit_number_edit">Unit Number</Label>
              <div className="flex gap-2">
                <Input
                  id="unit_number_edit"
                  value={unitNumberDraft}
                  onChange={(e) => setUnitNumberDraft(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={
                    updateUnitNumber.isPending ||
                    !unitNumberDraft.trim() ||
                    unitNumberDraft === currentSelectedUnit.unit_number
                  }
                  onClick={() =>
                    updateUnitNumber.mutate({ unitId: currentSelectedUnit.id, unit_number: unitNumberDraft.trim() })
                  }
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Category</p>
                <p className="mt-0.5 text-navy-900 dark:text-slate-100">
                  {currentSelectedUnit.unit_category?.name ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Current Status</p>
                <div className="mt-1">
                  <UnitStatusBadge status={currentSelectedUnit.status} />
                </div>
              </div>
              <div>
                <Label htmlFor="unit_base_price" className="mb-0.5">
                  Base Price
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="unit_base_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={basePriceDraft}
                    onChange={(e) => setBasePriceDraft(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={
                      updateUnitPrice.isPending ||
                      !basePriceDraft.trim() ||
                      Number(basePriceDraft) === Number(currentSelectedUnit.base_price)
                    }
                    onClick={() =>
                      updateUnitPrice.mutate({
                        unitId: currentSelectedUnit.id,
                        base_price: Number(basePriceDraft),
                      })
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Extra Charges</p>
                <p className="mt-0.5 text-navy-900 dark:text-slate-100">
                  PKR {Number(currentSelectedUnit.extra_charges).toLocaleString()}
                </p>
              </div>
              <div className="col-span-2 border-t border-slate-100 dark:border-navy-800 pt-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Price</p>
                <p className="mt-0.5 text-lg font-semibold text-navy-950 dark:text-white">
                  PKR {Number(currentSelectedUnit.total_price).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-navy-800 pt-4">
              <Label htmlFor="unit_status_change">Change Status</Label>
              <Select
                id="unit_status_change"
                value={currentSelectedUnit.status}
                onChange={(e) =>
                  updateUnitStatus.mutate({
                    unitId: currentSelectedUnit.id,
                    status: e.target.value as UnitStatus,
                  })
                }
              >
                {(["Available", "Booked", "Sold", "On-Hold", "Cancelled"] as UnitStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex justify-end border-t border-slate-100 dark:border-navy-800 pt-4">
              <button
                onClick={async () => {
                  const ok = await confirm(`Delete unit "${currentSelectedUnit.unit_number}"?`, {
                    danger: true,
                    confirmLabel: "Delete",
                  });
                  if (ok) deleteUnit.mutate(currentSelectedUnit.id);
                }}
                title="Delete unit"
                className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
