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
import type {
  Partner,
  ProjectDetail,
  ProjectFloor,
  ProjectPartnerShare,
  Unit,
  UnitCategory,
  UnitStatus,
} from "../../types";

type Tab = "overview" | "floors" | "units" | "partners";
type UnitView = "grid" | "table";

function floorNumberLabel(floorNo: string): string | null {
  const lower = floorNo.toLowerCase();
  if (lower.includes("ground")) return "0";
  const match = lower.match(/\d+/);
  return match ? match[0] : null;
}

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

  // Floor form
  const [floorForm, setFloorForm] = React.useState({ block: "", floor_no: "", no_of_units: "" });
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
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(message ?? "Failed to delete floor.");
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
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(message ?? "Failed to delete category.");
    },
  });

  // Bulk generate units
  const [genForm, setGenForm] = React.useState({ floor_id: "", unit_category_id: "" });
  const generateUnits = useMutation({
    mutationFn: async () => {
      const floor = project?.floors.find((f) => f.id === Number(genForm.floor_id));
      const floorLabel = floor ? floorNumberLabel(floor.floor_no) : null;
      const prefix = [floor?.block, floorLabel].filter(Boolean).join("-");
      return (
        await api.post<Unit[]>(`/units/bulk-generate/${projectId}`, {
          floor_id: Number(genForm.floor_id),
          unit_category_id: genForm.unit_category_id ? Number(genForm.unit_category_id) : null,
          starting_number: 1,
          prefix: prefix ? `${prefix}-` : "",
          base_price: 0,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units", projectId] });
      setGenerateModalOpen(false);
      setGenForm({ floor_id: "", unit_category_id: "" });
    },
  });

  const updateUnitStatus = useMutation({
    mutationFn: async ({ unitId, status }: { unitId: number; status: UnitStatus }) =>
      api.put(`/units/${unitId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["units", projectId] }),
  });

  const deleteUnit = useMutation({
    mutationFn: async (unitId: number) => api.delete(`/units/${unitId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units", projectId] });
      setSelectedUnit(null);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(message ?? "Failed to delete unit.");
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
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(message ?? "Failed to remove share.");
    },
  });

  const currentSelectedUnit = selectedUnit
    ? units?.find((u) => u.id === selectedUnit.id) ?? selectedUnit
    : null;

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
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Budget</p>
            <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">
              {project.total_budget ? `PKR ${Number(project.total_budget).toLocaleString()}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-slate-500 dark:text-slate-400">Floors / Blocks</p>
            <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">{project.floors.length}</p>
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
        {(["overview", "floors", "units", "partners"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
            }`}
          >
            {t === "floors" ? "Floors / Blocks" : t}
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
            <Button size="sm" onClick={() => setFloorModalOpen(true)}>
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
                  <tr key={f.id}>
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
              <Button size="sm" onClick={() => setGenerateModalOpen(true)}>
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
                    <tr key={u.id}>
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
                          onClick={() => {
                            if (window.confirm(`Delete unit "${u.unit_number}"?`)) {
                              deleteUnit.mutate(u.id);
                            }
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
                  <tr key={s.id}>
                    <td className="px-5 py-3 font-medium text-navy-900 dark:text-slate-100">{s.partner.name}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {s.investment_amount ? `PKR ${Number(s.investment_amount).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{s.share_percent}%</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${s.partner.name}'s share from this project?`)) {
                            deleteShare.mutate(s.id);
                          }
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
      <Modal open={floorModalOpen} onClose={() => setFloorModalOpen(false)} title="Add Floor / Block">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createFloor.mutate();
          }}
          className="space-y-4"
        >
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
            <Input
              id="floor_no"
              required
              value={floorForm.floor_no}
              onChange={(e) => setFloorForm({ ...floorForm, floor_no: e.target.value })}
              placeholder="e.g. Ground, 1st, 2nd"
            />
          </div>
          <div>
            <Label htmlFor="no_of_units">No. of Units on this Floor</Label>
            <Input
              id="no_of_units"
              type="number"
              required
              value={floorForm.no_of_units}
              onChange={(e) => setFloorForm({ ...floorForm, no_of_units: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setFloorModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createFloor.isPending}>
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
                    onClick={() => {
                      if (window.confirm(`Delete category "${c.name}"?`)) {
                        deleteCategory.mutate(c.id);
                      }
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
              {project.floors.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.block ? `${f.block} · ` : ""}
                  {f.floor_no} ({f.no_of_units} units)
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="gen_category">Unit Category</Label>
            <Select
              id="gen_category"
              value={genForm.unit_category_id}
              onChange={(e) => setGenForm({ ...genForm, unit_category_id: e.target.value })}
            >
              <option value="">— None —</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <Layers className="h-3.5 w-3.5" />
            Units will be created using the floor's configured unit count, numbered from 1
            (prefixed with the floor's block, if any) at the category's price.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setGenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={generateUnits.isPending || !genForm.floor_id}>
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
                <p className="text-xs text-slate-500 dark:text-slate-400">Base Price</p>
                <p className="mt-0.5 text-navy-900 dark:text-slate-100">
                  PKR {Number(currentSelectedUnit.base_price).toLocaleString()}
                </p>
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
                onClick={() => {
                  if (window.confirm(`Delete unit "${currentSelectedUnit.unit_number}"?`)) {
                    deleteUnit.mutate(currentSelectedUnit.id);
                  }
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
