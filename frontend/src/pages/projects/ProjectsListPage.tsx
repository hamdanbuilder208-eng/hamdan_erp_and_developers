import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input, Label, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { ProjectStatusBadge } from "../../components/ui/Badge";
import { TableRowsSkeleton } from "../../components/ui/Skeleton";
import { toast, apiErrorMessage } from "../../lib/toast";
import { confirm } from "../../lib/confirm";
import type { Project, ProjectGroup } from "../../types";

export default function ProjectsListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = React.useState(false);

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });

  const { data: groups } = useQuery({
    queryKey: ["project-groups"],
    queryFn: async () => (await api.get<ProjectGroup[]>("/projects/groups")).data,
  });

  const [form, setForm] = React.useState({
    project_name: "",
    address: "",
    total_budget: "",
    commission_percent: "",
    total_floors: "",
    project_group_id: "",
  });
  const [newGroupName, setNewGroupName] = React.useState("");

  const createGroup = useMutation({
    mutationFn: async (name: string) =>
      (await api.post<ProjectGroup>("/projects/groups", { name })).data,
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["project-groups"] });
      setForm((f) => ({ ...f, project_group_id: String(group.id) }));
      setNewGroupName("");
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId: number) => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to delete project."));
    },
  });

  const handleDelete = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    const ok = await confirm(`Delete project "${project.project_name}"? This cannot be undone.`, {
      danger: true,
      confirmLabel: "Delete",
    });
    if (ok) deleteProject.mutate(project.id);
  };

  const createProject = useMutation({
    mutationFn: async () =>
      (
        await api.post<Project>("/projects/", {
          project_name: form.project_name,
          address: form.address || null,
          total_budget: form.total_budget ? Number(form.total_budget) : null,
          commission_percent: form.commission_percent ? Number(form.commission_percent) : 0,
          total_floors: form.total_floors ? Number(form.total_floors) : 0,
          project_group_id: form.project_group_id ? Number(form.project_group_id) : null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setModalOpen(false);
      setForm({
        project_name: "",
        address: "",
        total_budget: "",
        commission_percent: "",
        total_floors: "",
        project_group_id: "",
      });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to create project.")),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Projects</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Set up construction projects, floors and units.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Code</th>
              <th className="px-5 py-3 font-medium">Project Name</th>
              <th className="px-5 py-3 font-medium">Group</th>
              <th className="px-5 py-3 font-medium">Budget</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3" />
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <TableRowsSkeleton rows={4} cols={7} />}
            {!isLoading && projects?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No projects yet. Click "New Project" to create your first one.
                </td>
              </tr>
            )}
            {projects?.map((p) => (
              <tr
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="cursor-pointer transition-colors hover:bg-brand-50/40"
              >
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{p.project_code}</td>
                <td className="px-5 py-3 font-medium text-navy-900 dark:text-slate-100">{p.project_name}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{p.project_group?.name ?? "—"}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {p.total_budget ? `PKR ${Number(p.total_budget).toLocaleString()}` : "—"}
                </td>
                <td className="px-5 py-3">
                  <ProjectStatusBadge status={p.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={(e) => handleDelete(e, p)}
                    title="Delete project"
                    className="rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:bg-danger-50 hover:text-danger-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Project"
        description="Create a new construction project (Job Master)."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createProject.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="project_name">Project Name</Label>
            <Input
              id="project_name"
              required
              value={form.project_name}
              onChange={(e) => setForm({ ...form, project_name: e.target.value })}
              placeholder="e.g. Hamdan Arcade"
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Full site address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="total_budget">Total Budget (PKR)</Label>
              <Input
                id="total_budget"
                type="number"
                value={form.total_budget}
                onChange={(e) => setForm({ ...form, total_budget: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="commission_percent">Vendor Commission %</Label>
              <Input
                id="commission_percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.commission_percent}
                onChange={(e) => setForm({ ...form, commission_percent: e.target.value })}
                placeholder="e.g. 5 for 5%"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="total_floors">Total Floors in Project</Label>
            <Input
              id="total_floors"
              type="number"
              min="0"
              value={form.total_floors}
              onChange={(e) => setForm({ ...form, total_floors: e.target.value })}
              placeholder="e.g. 5"
            />
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Used to limit the floor numbers you can add for this project.
            </p>
          </div>

          <div>
            <Label htmlFor="project_group_id">Project Group</Label>
            <Select
              id="project_group_id"
              value={form.project_group_id}
              onChange={(e) => setForm({ ...form, project_group_id: e.target.value })}
            >
              <option value="">— None —</option>
              {groups?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Add new group, e.g. Hamdan"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!newGroupName || createGroup.isPending}
                onClick={() => createGroup.mutate(newGroupName)}
              >
                Add
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
