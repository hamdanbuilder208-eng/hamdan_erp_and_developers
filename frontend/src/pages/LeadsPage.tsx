import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Label, Select } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { BulkSendMessageModal } from "../components/communication/BulkSendMessageModal";
import { TableRowsSkeleton } from "../components/ui/Skeleton";
import { toast, apiErrorMessage } from "../lib/toast";
import { confirm } from "../lib/confirm";
import { cn } from "../lib/utils";
import type { Lead, LeadFollowUpStatus, LeadImportResult } from "../types";

const emptyForm = { name: "", mobile: "", source: "", notes: "" };

const followUpStatuses: LeadFollowUpStatus[] = [
  "New",
  "Called",
  "No Answer",
  "Interested",
  "Not Interested",
  "Booked",
];

// Dot colour per follow-up status, so the list reads at a glance.
const statusDot: Record<LeadFollowUpStatus, string> = {
  New: "bg-slate-400",
  Called: "bg-brand-500",
  "No Answer": "bg-warning-500",
  Interested: "bg-success-500",
  "Not Interested": "bg-danger-500",
  Booked: "bg-success-700",
};

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [bulkModalOpen, setBulkModalOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [statusFilter, setStatusFilter] = React.useState<LeadFollowUpStatus | "">("");
  const [search, setSearch] = React.useState("");
  const [notesLead, setNotesLead] = React.useState<Lead | null>(null);
  const [notesDraft, setNotesDraft] = React.useState("");

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => (await api.get<Lead[]>("/leads/")).data,
  });

  const statusCounts = React.useMemo(() => {
    const counts = Object.fromEntries(followUpStatuses.map((s) => [s, 0])) as Record<LeadFollowUpStatus, number>;
    for (const l of leads ?? []) counts[l.follow_up_status] = (counts[l.follow_up_status] ?? 0) + 1;
    return counts;
  }, [leads]);

  const visibleLeads = React.useMemo(() => {
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return (leads ?? []).filter((l) => {
      if (statusFilter && l.follow_up_status !== statusFilter) return false;
      if (!terms.length) return true;
      const hay = [l.name, l.mobile, l.source, l.notes].filter(Boolean).join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [leads, statusFilter, search]);

  const updateFollowUp = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: LeadFollowUpStatus; notes?: string }) =>
      (await api.patch<Lead>(`/leads/${id}/follow-up`, { status, notes })).data,
    onSuccess: (updated) => {
      queryClient.setQueryData<Lead[]>(["leads"], (old) => old?.map((l) => (l.id === updated.id ? updated : l)));
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to update follow-up.")),
  });

  const createLead = useMutation({
    mutationFn: async () =>
      (
        await api.post<Lead>("/leads/", {
          name: form.name,
          mobile: form.mobile,
          source: form.source || null,
          notes: form.notes || null,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setModalOpen(false);
      setForm(emptyForm);
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to add lead.")),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: number) => api.delete(`/leads/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leads"] }),
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to delete lead.")),
  });

  const importExcel = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return (
        await api.post<LeadImportResult>("/leads/import", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        `Imported ${result.imported} of ${result.total_rows} rows` +
          (result.skipped_duplicates ? ` — ${result.skipped_duplicates} already existed` : "") +
          (result.skipped_invalid ? ` — ${result.skipped_invalid} had no phone number` : "") +
          ".",
      );
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, "Failed to import file.")),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Leads</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Prospective customers who haven't booked yet — import numbers from Excel and message
            them straight from here.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importExcel.mutate(file);
              e.target.value = "";
            }}
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importExcel.isPending}>
            <Upload className="h-4 w-4" />
            {importExcel.isPending ? "Importing..." : "Import Excel"}
          </Button>
          <Button variant="secondary" onClick={() => setBulkModalOpen(true)}>
            <Users className="h-4 w-4" />
            Bulk Message
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
        <FileSpreadsheet className="h-3.5 w-3.5" />
        Excel file needs a header row with a "Name" column and a "Mobile"/"Phone" column (any
        order) — numbers already in the system are skipped automatically.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {([["", "All", leads?.length ?? 0]] as [LeadFollowUpStatus | "", string, number][])
          .concat(followUpStatuses.map((s) => [s, s, statusCounts[s]]))
          .map(([key, label, count]) => (
            <button
              key={label}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === key
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-300 dark:hover:bg-navy-700",
              )}
            >
              {key && <span className={cn("h-2 w-2 rounded-full", statusDot[key])} />}
              {label} ({count})
            </button>
          ))}
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, mobile, notes…"
          className="ml-auto w-64"
        />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Mobile</th>
              <th className="px-5 py-3 font-medium">Follow-up</th>
              <th className="px-5 py-3 font-medium">Source</th>
              <th className="px-5 py-3 font-medium">Notes</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && <TableRowsSkeleton cols={6} />}
            {!isLoading && leads?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No leads yet. Click "Import Excel" or "Add Lead" to get started.
                </td>
              </tr>
            )}
            {!isLoading && !!leads?.length && visibleLeads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No leads match this filter.
                </td>
              </tr>
            )}
            {visibleLeads.map((l) => (
              <tr key={l.id} className="transition-colors hover:bg-slate-100 dark:hover:bg-navy-800">
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">{l.name}</td>
                <td className="px-5 py-3 font-mono text-slate-500 dark:text-slate-400">{l.mobile}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusDot[l.follow_up_status])} />
                    <Select
                      value={l.follow_up_status}
                      onChange={(e) =>
                        updateFollowUp.mutate({ id: l.id, status: e.target.value as LeadFollowUpStatus })
                      }
                      className="h-8 w-40 text-xs"
                    >
                      {followUpStatuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {l.follow_up_date && (
                    <div className="mt-1 pl-4.5 text-[11px] text-slate-400 dark:text-slate-500">
                      Updated {l.follow_up_date}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{l.source ?? "—"}</td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setNotesLead(l);
                      setNotesDraft(l.notes ?? "");
                    }}
                    title="Edit notes"
                    className="group flex max-w-xs items-center gap-1.5 text-left"
                  >
                    <span className="truncate" title={l.notes ?? ""}>
                      {l.notes ?? "—"}
                    </span>
                    <Pencil className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={async () => {
                      const ok = await confirm("Delete this lead?", { danger: true, confirmLabel: "Delete" });
                      if (ok) deleteLead.mutate(l.id);
                    }}
                    title="Delete lead"
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Lead">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createLead.mutate();
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="lead_name">Name</Label>
            <Input
              id="lead_name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="lead_mobile">Mobile</Label>
            <Input
              id="lead_mobile"
              required
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              placeholder="03001234567"
            />
          </div>
          <div>
            <Label htmlFor="lead_source">Source (optional)</Label>
            <Input
              id="lead_source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="Facebook, Referral, Walk-in..."
            />
          </div>
          <div>
            <Label htmlFor="lead_notes">Notes (optional)</Label>
            <Input
              id="lead_notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createLead.isPending}>
              Add Lead
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!notesLead}
        onClose={() => setNotesLead(null)}
        title="Lead Notes"
        description={notesLead ? `${notesLead.name} · ${notesLead.mobile}` : undefined}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!notesLead) return;
            updateFollowUp.mutate(
              { id: notesLead.id, status: notesLead.follow_up_status, notes: notesDraft },
              { onSuccess: () => setNotesLead(null) },
            );
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="lead_notes_edit">What did they say? Next step?</Label>
            <textarea
              id="lead_notes_edit"
              rows={4}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy-950 shadow-sm focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setNotesLead(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateFollowUp.isPending}>
              Save Notes
            </Button>
          </div>
        </form>
      </Modal>

      <BulkSendMessageModal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} source="leads" />
    </div>
  );
}
