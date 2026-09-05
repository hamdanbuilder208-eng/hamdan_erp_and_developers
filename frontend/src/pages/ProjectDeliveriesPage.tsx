import * as React from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Truck } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card, CardContent } from "../components/ui/Card";
import { Input, Label } from "../components/ui/Input";
import { toast, apiErrorMessage } from "../lib/toast";
import type { MaterialIssue, ProjectDetail } from "../types";

export default function ProjectDeliveriesPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [receivingId, setReceivingId] = React.useState<number | null>(null);
  const [receivedBy, setReceivedBy] = React.useState("");

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await api.get<ProjectDetail>(`/projects/${id}`)).data,
  });

  const { data: issues, isLoading } = useQuery({
    queryKey: ["material-issues", "project", id],
    queryFn: async () =>
      (await api.get<MaterialIssue[]>("/inventory/issues", { params: { project_id: id } })).data,
  });

  const pending = (issues ?? []).filter(
    (i) => i.status === "Dispatched" && i.reason === "Site Consumption",
  );

  const receive = useMutation({
    mutationFn: async (issueId: number) =>
      (
        await api.put<MaterialIssue>(`/inventory/issues/${issueId}/receive`, {
          received_by: receivedBy,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-issues", "project", id] });
      setReceivingId(null);
      setReceivedBy("");
      toast.success("Delivery confirmed as received.");
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to confirm receipt.")),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-navy-950">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-5 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <PackageCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-navy-950 dark:text-white">
                Pending deliveries — {project?.project_name ?? "…"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confirm what has physically arrived at site.
              </p>
            </div>
          </div>

          {isLoading && <p className="py-6 text-center text-sm text-slate-400">Loading...</p>}

          {!isLoading && pending.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
              Nothing pending — no deliveries waiting on confirmation.
            </p>
          )}

          <div className="space-y-3">
            {pending.map((iss) => (
              <div
                key={iss.id}
                className="rounded-lg border border-slate-100 p-3 dark:border-navy-800"
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 shrink-0 text-warning-600" />
                  <p className="text-sm font-medium text-navy-900 dark:text-slate-100">
                    {iss.issue_no}
                  </p>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {iss.warehouse?.name ?? "—"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {iss.lines.map((l) => `${l.material.name} ×${l.quantity}`).join(", ")}
                </p>

                {receivingId === iss.id ? (
                  <div className="mt-3 space-y-2">
                    <Label htmlFor={`received_by_${iss.id}`}>Your name</Label>
                    <Input
                      id={`received_by_${iss.id}`}
                      autoFocus
                      value={receivedBy}
                      onChange={(e) => setReceivedBy(e.target.value)}
                      placeholder="Who is confirming this delivery?"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setReceivingId(null);
                          setReceivedBy("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        disabled={!receivedBy || receive.isPending}
                        onClick={() => receive.mutate(iss.id)}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={() => setReceivingId(iss.id)}
                  >
                    Mark Received
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
