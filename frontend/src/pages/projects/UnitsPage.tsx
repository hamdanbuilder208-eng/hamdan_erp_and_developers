import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Pencil, Plus, Sparkles, Tags, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { UnitStatusBadge } from "../../components/ui/Badge";
import { UnitAvailabilityGrid } from "../../components/units/UnitAvailabilityGrid";
import { toast, apiErrorMessage } from "../../lib/toast";
import { confirm } from "../../lib/confirm";
import type { Project, ProjectDetail, Unit, UnitCategory, UnitStatus } from "../../types";

type SubTab = "floors" | "units";
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

export default function UnitsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });

  const projectIdParam = searchParams.get("project");
  const [projectId, setProjectId] = React.useState<number | null>(
    projectIdParam ? Number(projectIdParam) : null,
  );

  React.useEffect(() => {
    if (!projectId && projects && projects.length > 0) {
      setProjectId(projects[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const selectProject = (id: number) => {
    setProjectId(id);
    setSearchParams(id ? { project: String(id) } : {});
  };

  const [subTab, setSubTab] = React.useState<SubTab>("units");
  const [floorModalOpen, setFloorModalOpen] = React.useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const [generateModalOpen, setGenerateModalOpen] = React.useState(false);
  const [unitView, setUnitView] = React.useState<UnitView>("grid");
  const [selectedUnit, setSelectedUnit] = React.useState<Unit | null>(null);

  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${projectId}`)).data,
    enabled: !!projectId,
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
        await api.post(`/projects/${projectId}/floors`, {
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

  // Bulk generate units
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

  const currentSelectedUnit = selectedUnit
    ? units?.find((u) => u.id === selectedUnit.id) ?? selectedUnit
    : null;

  React.useEffect(() => {
    setUnitNumberDraft(currentSelectedUnit?.unit_number ?? "");
  }, [currentSelectedUnit?.id, currentSelectedUnit?.unit_number]);

  React.useEffect(() => {
    setBasePriceDraft(currentSelectedUnit ? String(currentSelectedUnit.base_price) : "");
  }, [currentSelectedUnit?.id, currentSelectedUnit?.base_price]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Units</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage floors, unit categories and generated units for a project.
          </p>
        </div>
        <div className="w-64">
          <Select
            aria-label="Select project"
            value={projectId ?? ""}
            onChange={(e) => selectProject(Number(e.target.value))}
          >
            <option value="" disabled>
              Select a project
            </option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!projectId || !project ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            {projects?.length === 0
              ? "No projects yet. Create one from the Projects page first."
              : "Select a project above to manage its floors and units."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-1 border-b border-slate-200 dark:border-navy-700">
            {(["units", "floors"] as SubTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  subTab === t
                    ? "border-b-2 border-brand-600 text-brand-700"
                    : "text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
                }`}
              >
                {t === "floors" ? "Floors / Blocks" : "Units"}
              </button>
            ))}
          </div>

          {subTab === "floors" && (
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

          {subTab === "units" && (
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
        </>
      )}

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
            if (draftCount !== (project?.total_floors ?? 0)) {
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
              {project?.floors.map((f) => {
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
