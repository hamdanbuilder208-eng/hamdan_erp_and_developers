import * as React from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { toast, apiErrorMessage } from "../lib/toast";
import type { Material, MaterialIssueReason, Project, Warehouse } from "../types";

const todayIso = () => new Date().toISOString().slice(0, 10);

interface Line {
  material_id: string;
  quantity: string;
}

export default function WarehouseDispatchPage() {
  const { id } = useParams();

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get<Warehouse[]>("/inventory/warehouses")).data,
  });
  const warehouse = warehouses?.find((w) => w.id === Number(id));

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects/")).data,
  });
  const { data: materials } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await api.get<Material[]>("/inventory/materials")).data,
  });

  const [projectId, setProjectId] = React.useState("");
  const [reason, setReason] = React.useState<MaterialIssueReason>("Site Consumption");
  const [issuedTo, setIssuedTo] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([{ material_id: "", quantity: "" }]);
  const [lastIssueNo, setLastIssueNo] = React.useState<string | null>(null);

  const reset = () => {
    setProjectId("");
    setReason("Site Consumption");
    setIssuedTo("");
    setLines([{ material_id: "", quantity: "" }]);
  };

  const dispatch = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ issue_no: string }>("/inventory/issues", {
          issue_date: todayIso(),
          project_id: Number(projectId),
          warehouse_id: Number(id),
          reason,
          issued_to: issuedTo || null,
          lines: lines
            .filter((l) => l.material_id)
            .map((l) => ({ material_id: Number(l.material_id), quantity: Number(l.quantity) || 0 })),
        })
      ).data,
    onSuccess: (data) => {
      setLastIssueNo(data.issue_no);
      reset();
      toast.success(`Dispatched — ${data.issue_no}`);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to record dispatch.")),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-navy-950">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <WarehouseIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-navy-950 dark:text-white">
                Dispatch from {warehouse?.name ?? "warehouse"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                What's leaving right now — reduces this warehouse's stock immediately.
              </p>
            </div>
          </div>

          {lastIssueNo && (
            <div className="flex items-center gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Recorded as {lastIssueNo}. Log another below if more is leaving.
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              dispatch.mutate();
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="project">Going to project / site</Label>
              <Select id="project" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Select project</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="reason">Reason</Label>
              <Select
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as MaterialIssueReason)}
              >
                <option value="Site Consumption">Site Consumption</option>
                <option value="Damaged / Wastage">Damaged / Wastage</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="issued_to">Issued to</Label>
              <Input
                id="issued_to"
                value={issuedTo}
                onChange={(e) => setIssuedTo(e.target.value)}
                placeholder="e.g. Site Engineer — Block A"
              />
            </div>

            <div className="space-y-2">
              <Label>Materials leaving</Label>
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
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setLines([...lines, { material_id: "", quantity: "" }])}
              >
                <Plus className="h-3.5 w-3.5" />
                Add line
              </Button>
            </div>

            <Button type="submit" className="w-full" disabled={dispatch.isPending}>
              Confirm Dispatch
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
