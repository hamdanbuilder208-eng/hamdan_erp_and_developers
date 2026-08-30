import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { portalApi } from "../../lib/portalApi";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card";
import { Input, Label } from "../../components/ui/Input";

export default function CustomerChangePasswordPage() {
  const [form, setForm] = React.useState({ current: "", next: "", confirm: "" });
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const changePassword = useMutation({
    mutationFn: async () =>
      portalApi.post("/portal/me/change-password", {
        current_password: form.current,
        new_password: form.next,
      }),
    onSuccess: () => {
      setSuccess(true);
      setForm({ current: "", next: "", confirm: "" });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to change password.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (form.next !== form.confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (form.next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    changePassword.mutate();
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="current">Current Password</Label>
            <Input
              id="current"
              type="password"
              required
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              autoComplete="current-password"
            />
          </div>
          <div>
            <Label htmlFor="next">New Password</Label>
            <Input
              id="next"
              type="password"
              required
              value={form.next}
              onChange={(e) => setForm({ ...form, next: e.target.value })}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirm New Password</Label>
            <Input
              id="confirm"
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
              Password changed successfully.
            </p>
          )}

          <Button type="submit" disabled={changePassword.isPending}>
            Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
