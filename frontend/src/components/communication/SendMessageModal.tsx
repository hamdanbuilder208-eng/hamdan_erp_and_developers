import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button } from "../ui/Button";
import { Input, Label, Select } from "../ui/Input";
import { Modal } from "../ui/Modal";
import type { CommunicationChannel, CommunicationLog, CommunicationRelatedType } from "../../types";

const channels: CommunicationChannel[] = ["WhatsApp", "SMS"];

interface SendMessageModalProps {
  open: boolean;
  onClose: () => void;
  defaultPhone: string;
  defaultName?: string;
  defaultMessage: string;
  relatedType: CommunicationRelatedType;
  relatedId?: number | null;
}

export function SendMessageModal({
  open,
  onClose,
  defaultPhone,
  defaultName,
  defaultMessage,
  relatedType,
  relatedId,
}: SendMessageModalProps) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = React.useState<CommunicationChannel>("WhatsApp");
  const [phone, setPhone] = React.useState(defaultPhone);
  const [message, setMessage] = React.useState(defaultMessage);

  React.useEffect(() => {
    if (open) {
      setPhone(defaultPhone);
      setMessage(defaultMessage);
      setChannel("WhatsApp");
    }
  }, [open, defaultPhone, defaultMessage]);

  const send = useMutation({
    mutationFn: async () =>
      (
        await api.post<CommunicationLog>("/communications/send", {
          channel,
          recipient_phone: phone,
          recipient_name: defaultName || null,
          message_body: message,
          related_type: relatedType,
          related_id: relatedId ?? null,
        })
      ).data,
    onSuccess: (log) => {
      queryClient.invalidateQueries({ queryKey: ["communications"] });
      if (log.status === "Sent") {
        window.alert("Message sent.");
        onClose();
      } else {
        window.alert(`Failed: ${log.error_message ?? "Unknown error"}`);
      }
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      window.alert(detail ?? "Failed to send message.");
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send WhatsApp / SMS"
      description="Review the message before sending — it goes out immediately."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="msg_channel">Channel</Label>
            <Select
              id="msg_channel"
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
            <Label htmlFor="msg_phone">Phone Number</Label>
            <Input
              id="msg_phone"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92300xxxxxxx"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="msg_body">Message</Label>
          <textarea
            id="msg_body"
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-navy-950 shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-100"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={send.isPending}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}
