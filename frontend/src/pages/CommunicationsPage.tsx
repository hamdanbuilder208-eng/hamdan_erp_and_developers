import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MessageCircle, Plus, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { SendMessageModal } from "../components/communication/SendMessageModal";
import type { CommunicationChannel, CommunicationLog } from "../types";

const channels: CommunicationChannel[] = ["WhatsApp", "SMS"];

export default function CommunicationsPage() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [filterChannel, setFilterChannel] = React.useState("");

  const { data: logs, isLoading } = useQuery({
    queryKey: ["communications", filterChannel],
    queryFn: async () =>
      (
        await api.get<CommunicationLog[]>("/communications/", {
          params: { channel: filterChannel || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">WhatsApp / SMS</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Every message sent from the ERP — automatically logged, plus ad-hoc sends.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Message
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)} className="w-44">
          <option value="">All Channels</option>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-navy-800/60 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Channel</th>
              <th className="px-5 py-3 font-medium">Recipient</th>
              <th className="px-5 py-3 font-medium">Related</th>
              <th className="px-5 py-3 font-medium">Message</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && logs?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">
                  No messages sent yet. Click "New Message" or send from Receipts / Bookings / Refunds.
                </td>
              </tr>
            )}
            {logs?.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {new Date(l.created_at).toLocaleString()}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={l.channel === "WhatsApp" ? "success" : "info"}>{l.channel}</Badge>
                </td>
                <td className="px-5 py-3 text-navy-900 dark:text-slate-100">
                  {l.recipient_name ? `${l.recipient_name} · ` : ""}
                  {l.recipient_phone}
                </td>
                <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                  {l.related_type}
                  {l.related_id ? ` #${l.related_id}` : ""}
                </td>
                <td className="px-5 py-3 max-w-xs truncate text-slate-500 dark:text-slate-400" title={l.message_body}>
                  {l.message_body}
                </td>
                <td className="px-5 py-3">
                  {l.status === "Sent" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Sent
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-danger-600"
                      title={l.error_message ?? ""}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Failed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {!isLoading && (logs?.length ?? 0) === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <MessageCircle className="h-3.5 w-3.5" />
          Tip: configure Twilio credentials in the backend .env to actually deliver messages.
        </p>
      )}

      <SendMessageModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        defaultPhone=""
        defaultMessage=""
        relatedType="Other"
      />
    </div>
  );
}
