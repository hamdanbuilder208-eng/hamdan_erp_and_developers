import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ProjectStatusBadge } from "../../components/ui/Badge";
import { toast, apiErrorMessage } from "../../lib/toast";
import type {
  Partner,
  PaymentTemplate,
  ProjectDetail,
  ProjectGroup,
  ProjectPartnerShare,
  ScheduleFrequency,
  Unit,
  UnitCategory,
} from "../../types";
import { confirm } from "../../lib/confirm";
import { useAuthStore } from "../../store/authStore";
import { SpecialLevelsPicker } from "../../components/projects/SpecialLevelsPicker";

type Tab = "overview" | "partners" | "payment-plan";

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

  // Payment plan templates — the project's standard schedules (booking %,
  // then a milestone/installment breakdown of the rest), pulled in to
  // prefill a new booking instead of typing the same plan out every time.
  // One plan per unit category (1 Bed Lounge, 2 Bed Lounge, ...) plus a
  // default plan for any category without its own.
  const { data: paymentTemplates } = useQuery({
    queryKey: ["payment-templates", projectId],
    queryFn: async () =>
      (await api.get<PaymentTemplate[]>(`/projects/${projectId}/payment-templates`)).data,
    enabled: !!projectId,
  });

  const { data: allCategories } = useQuery({
    queryKey: ["unit-categories"],
    queryFn: async () => (await api.get<UnitCategory[]>("/unit-categories/")).data,
  });

  // Categories this project actually uses, plus any that already have a plan.
  const planCategories = React.useMemo(() => {
    const ids = new Set<number>();
    units?.forEach((u) => u.unit_category_id && ids.add(u.unit_category_id));
    paymentTemplates?.forEach((t) => t.unit_category_id && ids.add(t.unit_category_id));
    return (allCategories ?? []).filter((c) => ids.has(c.id));
  }, [units, paymentTemplates, allCategories]);

  // "" = the project's default plan
  const [planCategoryId, setPlanCategoryId] = React.useState("");
  const paymentTemplate = paymentTemplates?.find(
    (t) => String(t.unit_category_id ?? "") === planCategoryId,
  );
  const defaultTemplate = paymentTemplates?.find((t) => t.unit_category_id === null);
  const planCategoryName =
    planCategories.find((c) => String(c.id) === planCategoryId)?.name ?? "Default";

  const [templateForm, setTemplateForm] = React.useState<{
    booking_percent: string;
    lines: TemplateLineForm[];
  }>({ booking_percent: "", lines: [] });
  const [templateError, setTemplateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTemplateError(null);
    setTemplateForm(
      paymentTemplate
        ? {
            booking_percent: String(paymentTemplate.booking_percent),
            lines: paymentTemplate.lines.map((l) => ({
              label: l.label,
              frequency: l.frequency,
              no_of_installments: String(l.no_of_installments),
              percent: String(l.percent),
              months_after_booking: String(l.months_after_booking),
            })),
          }
        : { booking_percent: "", lines: [] },
    );
  }, [paymentTemplate, planCategoryId]);

  const planParams = planCategoryId ? { unit_category_id: Number(planCategoryId) } : undefined;

  const copyDefaultPlan = () => {
    if (!defaultTemplate) return;
    setTemplateForm({
      booking_percent: String(defaultTemplate.booking_percent),
      lines: defaultTemplate.lines.map((l) => ({
        label: l.label,
        frequency: l.frequency,
        no_of_installments: String(l.no_of_installments),
        percent: String(l.percent),
        months_after_booking: String(l.months_after_booking),
      })),
    });
  };

  const deleteTemplate = useMutation({
    mutationFn: async () =>
      api.delete(`/projects/${projectId}/payment-template`, { params: planParams }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-templates", projectId] });
      queryClient.invalidateQueries({ queryKey: ["payment-template"] });
      toast.success("Payment plan removed.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to remove payment plan.")),
  });

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
        await api.put<PaymentTemplate>(
          `/projects/${projectId}/payment-template`,
          {
            booking_percent: Number(templateForm.booking_percent) || 0,
            lines: templateForm.lines.map((l) => ({
              label: l.label || "Installments",
              frequency: l.frequency,
              no_of_installments: Number(l.no_of_installments) || 0,
              percent: Number(l.percent) || 0,
              months_after_booking: Number(l.months_after_booking) || 0,
            })),
          },
          { params: planParams },
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-templates", projectId] });
      queryClient.invalidateQueries({ queryKey: ["payment-template"] });
      setTemplateError(null);
      toast.success(`${planCategoryName} payment plan saved.`);
    },
    onError: (err: unknown) =>
      setTemplateError(apiErrorMessage(err, "Failed to save payment plan template.")),
  });

  // Edit project details — admin only (the backend enforces this too).
  const isAdmin = useAuthStore((s) => s.user?.role.is_admin) ?? false;
  const { data: groups } = useQuery({
    queryKey: ["project-groups"],
    queryFn: async () => (await api.get<ProjectGroup[]>("/projects/groups")).data,
    enabled: isAdmin,
  });
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    project_name: "",
    address: "",
    total_budget: "",
    total_floors: "",
    has_lower_ground: false,
    has_ground: true,
    has_mezzanine: false,
    project_group_id: "",
    status: "Active" as ProjectDetail["status"],
  });
  const openEditModal = () => {
    if (!project) return;
    setEditForm({
      project_name: project.project_name,
      address: project.address ?? "",
      total_budget: project.total_budget ? String(project.total_budget) : "",
      total_floors: project.total_floors ? String(project.total_floors) : "",
      has_lower_ground: project.has_lower_ground,
      has_ground: project.has_ground,
      has_mezzanine: project.has_mezzanine,
      project_group_id: project.project_group_id ? String(project.project_group_id) : "",
      status: project.status,
    });
    setEditModalOpen(true);
  };
  const updateProject = useMutation({
    mutationFn: async () =>
      (
        await api.put(`/projects/${projectId}`, {
          project_name: editForm.project_name,
          address: editForm.address || null,
          total_budget: editForm.total_budget ? Number(editForm.total_budget) : null,
          total_floors: editForm.total_floors ? Number(editForm.total_floors) : 0,
          has_lower_ground: editForm.has_lower_ground,
          has_ground: editForm.has_ground,
          has_mezzanine: editForm.has_mezzanine,
          project_group_id: editForm.project_group_id ? Number(editForm.project_group_id) : null,
          status: editForm.status,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditModalOpen(false);
      toast.success("Project updated.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update project.")),
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
  const emptyShareForm = { partner_id: "", investment_amount: "", share_percent: "", retention_percent: "" };
  const [shareForm, setShareForm] = React.useState(emptyShareForm);
  const [shareError, setShareError] = React.useState<string | null>(null);

  const [editingBackup, setEditingBackup] = React.useState<{ id: number; value: string } | null>(null);
  const updateBackup = useMutation({
    mutationFn: async () =>
      api.put(`/projects/partner-shares/${editingBackup!.id}`, {
        retention_percent: Number(editingBackup!.value) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-partner-shares", projectId] });
      queryClient.invalidateQueries({ queryKey: ["partner-summary"] });
      setEditingBackup(null);
      toast.success("Profit backup % updated.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update profit backup %.")),
  });

  const totalSharePercent = shares?.reduce((s, sh) => s + Number(sh.share_percent), 0) ?? 0;

  const addShare = useMutation({
    mutationFn: async () =>
      (
        await api.post<ProjectPartnerShare>(`/projects/${projectId}/partner-shares`, {
          partner_id: Number(shareForm.partner_id),
          investment_amount: shareForm.investment_amount ? Number(shareForm.investment_amount) : 0,
          share_percent: Number(shareForm.share_percent),
          retention_percent: Number(shareForm.retention_percent) || 0,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-partner-shares", projectId] });
      queryClient.invalidateQueries({ queryKey: ["partner-summary"] });
      setShareModalOpen(false);
      setShareForm(emptyShareForm);
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
          {isAdmin && (
            <Button size="sm" variant="secondary" onClick={openEditModal}>
              <Pencil className="h-4 w-4" />
              Edit Project
            </Button>
          )}
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
              {isAdmin && (
                <button
                  onClick={openEditModal}
                  className="rounded-md p-1 text-slate-400 dark:text-slate-500 hover:bg-brand-50 hover:text-brand-600"
                  title="Edit project"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
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
        <Link to={`/units?project=${projectId}`}>
          <Card className="h-full transition-colors hover:bg-slate-50 dark:hover:bg-navy-800/60">
            <CardContent>
              <p className="text-xs text-slate-500 dark:text-slate-400">Floors / Blocks</p>
              <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">
                {project.floors.length}
                {project.total_floors ? ` / ${project.total_floors}` : ""}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to={`/units?project=${projectId}`}>
          <Card className="h-full transition-colors hover:bg-slate-50 dark:hover:bg-navy-800/60">
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Units</p>
                <Boxes className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              </div>
              <p className="mt-1 text-lg font-semibold text-navy-950 dark:text-white">{units?.length ?? 0}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-navy-700">
        {(["overview", "partners", "payment-plan"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 dark:text-slate-400 hover:text-navy-800 dark:text-slate-200"
            }`}
          >
            {t === "payment-plan" ? "Payment Plan" : t}
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
            <div className="col-span-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Address</p>
              <p className="mt-0.5 text-navy-900 dark:text-slate-100">{project.address || "—"}</p>
            </div>
          </CardContent>
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
                  <th className="px-5 py-3 font-medium">Profit Backup %</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
                {shares?.length === 0 && (
                  <tr>
                    <td colSpan={5}className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
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
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                      {editingBackup?.id === s.id ? (
                        <form
                          className="flex items-center gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            updateBackup.mutate();
                          }}
                        >
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            required
                            autoFocus
                            value={editingBackup.value}
                            onChange={(e) => setEditingBackup({ id: s.id, value: e.target.value })}
                            className="h-8 w-20"
                          />
                          <Button type="submit" size="sm" disabled={updateBackup.isPending}>
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => setEditingBackup(null)}>
                            Cancel
                          </Button>
                        </form>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {Number(s.retention_percent)}%
                          <button
                            onClick={() => setEditingBackup({ id: s.id, value: String(Number(s.retention_percent)) })}
                            title="Change profit backup %"
                            className="rounded-md p-1 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:text-slate-500"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </span>
                      )}
                    </td>
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
              Set a separate plan for each unit category (percentages of the unit's price) —
              pulled in via "Use Standard Schedule" on New Booking. Categories without their own
              plan use the Default plan.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[{ id: "", name: "Default (all categories)" }, ...planCategories.map((c) => ({ id: String(c.id), name: c.name }))].map(
                (c) => {
                  const hasPlan = paymentTemplates?.some(
                    (t) => String(t.unit_category_id ?? "") === c.id,
                  );
                  return (
                    <button
                      key={c.id || "default"}
                      type="button"
                      onClick={() => setPlanCategoryId(c.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        planCategoryId === c.id
                          ? "border-brand-600 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-navy-700 dark:text-slate-400 dark:hover:bg-navy-800"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${hasPlan ? "bg-success-500" : "bg-slate-300 dark:bg-navy-600"}`}
                        title={hasPlan ? "Plan set" : "No plan yet"}
                      />
                      {c.name}
                    </button>
                  );
                },
              )}
            </div>
            {planCategories.length === 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Assign unit categories to this project's units to set a separate plan per category.
              </p>
            )}
            {planCategoryId && !paymentTemplate && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-navy-800/60 dark:text-slate-400">
                <span>
                  {planCategoryName} has no plan of its own yet —{" "}
                  {defaultTemplate ? "bookings use the Default plan." : "no Default plan either."}
                </span>
                {defaultTemplate && (
                  <Button type="button" size="sm" variant="secondary" onClick={copyDefaultPlan}>
                    Copy Default Plan
                  </Button>
                )}
              </div>
            )}
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
              <div className="flex items-center gap-2">
                {paymentTemplate && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={deleteTemplate.isPending}
                    onClick={async () => {
                      const ok = await confirm(`Remove the ${planCategoryName} payment plan?`, {
                        danger: true,
                        confirmLabel: "Remove",
                      });
                      if (ok) deleteTemplate.mutate();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={saveTemplate.isPending || templateTotalPercent !== 100}
                  onClick={() => saveTemplate.mutate()}
                >
                  Save {planCategoryName} Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Project Modal (admin only) */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Project"
        description="Only admins can change project details."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateProject.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="edit_project_name">Project Name</Label>
            <Input
              id="edit_project_name"
              required
              value={editForm.project_name}
              onChange={(e) => setEditForm({ ...editForm, project_name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="edit_address">Address</Label>
            <Input
              id="edit_address"
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="project_budget">Total Budget (PKR)</Label>
              <Input
                id="project_budget"
                type="number"
                step="0.01"
                min="0"
                value={editForm.total_budget}
                onChange={(e) => setEditForm({ ...editForm, total_budget: e.target.value })}
                placeholder="Leave blank to clear budget"
              />
            </div>
            <div>
              <Label htmlFor="edit_total_floors">Total Floors</Label>
              <Input
                id="edit_total_floors"
                type="number"
                min={project.floors.length}
                value={editForm.total_floors}
                onChange={(e) => setEditForm({ ...editForm, total_floors: e.target.value })}
              />
              {project.floors.length > 0 && (
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {project.floors.length} floor(s) already added — can't go below that.
                </p>
              )}
            </div>
          </div>
          <SpecialLevelsPicker
            value={editForm}
            onChange={(levels) => setEditForm({ ...editForm, ...levels })}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit_group">Project Group</Label>
              <Select
                id="edit_group"
                value={editForm.project_group_id}
                onChange={(e) => setEditForm({ ...editForm, project_group_id: e.target.value })}
              >
                <option value="">— None —</option>
                {groups?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_status">Status</Label>
              <Select
                id="edit_status"
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value as ProjectDetail["status"] })
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateProject.isPending}>
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
          <div>
            <Label htmlFor="share_retention">Profit Backup %</Label>
            <Input
              id="share_retention"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={shareForm.retention_percent}
              onChange={(e) => setShareForm({ ...shareForm, retention_percent: e.target.value })}
              className="w-40"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              How much of this partner's profit on this project stays with the company as backup.
              Withdrawing beyond it only shows a warning. 0 = no backup.
            </p>
          </div>
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
    </div>
  );
}
