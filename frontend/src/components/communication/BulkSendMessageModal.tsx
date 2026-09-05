import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Input, Label, Select } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { toast, apiErrorMessage } from "../../lib/toast";
import type { Allottee, CommunicationBulkResult, CommunicationChannel } from "../../types";

const channels: CommunicationChannel[] = ["WhatsApp", "SMS"];

interface BulkSendMessageModalProps {
  open: boolean;
  onClose: () => void;
}

export function BulkSendMessageModal({ open, onClose }: BulkSendMessageModalProps) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = React.useState<CommunicationChannel>("WhatsApp");
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setChannel("WhatsApp");
      setSearch("");
      setSelectedIds(new Set());
      setMessage("");
    }
  }, [open]);

  const { data: allottees, isLoading } = useQuery({
    queryKey: ["allottees", "bulk-send"],
    queryFn: async () => (await api.get<Allottee[]>("/allottees/")).data,
    enabled: open,
  });

  const withMobile = (allottees ?? []).filter((a) => !!a.mobile);
  const filtered = withMobile.filter(
    (a) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.mobile?.includes(search),
  );

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((a) => next.add(a.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const allRecipients = withMobile
    .filter((a) => selectedIds.has(a.id))
    .map((a) => ({ phone: a.mobile as string, name: a.name }));

  const send = useMutation({
    mutationFn: async () =>
      (
        await api.post<CommunicationBulkResult>("/communications/send-bulk", {
          channel,
          recipients: allRecipients,
          message_body: message,
          related_type: "Other",
        })
      ).data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      if (result.failed === 0) {
        toast.success(`Sent to all ${result.sent} recipient${result.sent === 1 ? "" : "s"}.`);
        onClose();
      } else {
        toast.error(`Sent ${result.sent} of ${result.total} — ${result.failed} failed. Check the log below.`);
      }
    },
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, "Failed to send bulk message."));
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bulk Message"
      description="Send the same WhatsApp / SMS message to multiple people at once."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="bulk_channel">Channel</Label>
          <Select
            id="bulk_channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
          >
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="bulk_search">
              Recipients{" "}
              <span className="font-normal text-slate-400">
                ({selectedIds.size} customer{selectedIds.size === 1 ? "" : "s"} selected)
              </span>
            </Label>
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={selectAllFiltered} className="font-medium text-brand-600 hover:underline">
                Select all shown
              </button>
              <button type="button" onClick={clearSelection} className="font-medium text-slate-400 hover:underline">
                Clear
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="bulk_search"
              className="pl-9"
              placeholder="Search customers by name or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700">
            {isLoading && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">Loading customers...</p>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                No customers with a mobile number match.
              </p>
            )}
            {filtered.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50 dark:border-navy-800 dark:hover:bg-navy-800/60"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(a.id)}
                  onChange={() => toggle(a.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="flex-1 text-navy-900 dark:text-slate-100">{a.name}</span>
                <span className="text-xs text-slate-400">{a.mobile}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="bulk_message">Message</Label>
          <textarea
            id="bulk_message"
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy-950 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-100"
          />
        </div>

        <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <Users className="h-3.5 w-3.5" />
          Will send to {allRecipients.length} recipient{allRecipients.length === 1 ? "" : "s"} — one
          message each, individually logged.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={send.isPending || allRecipients.length === 0}>
            {send.isPending ? "Sending..." : `Send to ${allRecipients.length}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
