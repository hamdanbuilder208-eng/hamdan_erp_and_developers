import * as React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { portalApi } from "../../lib/portalApi";
import { Button } from "../../components/ui/Button";
import { Input, Label } from "../../components/ui/Input";

export default function CustomerForgotPasswordPage() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState({ mobile: "", cnic: "", password: "", confirm: "" });
  const [error, setError] = React.useState<string | null>(null);

  const reset = useMutation({
    mutationFn: async () =>
      portalApi.post("/portal/forgot-password", {
        mobile: form.mobile,
        cnic: form.cnic,
        new_password: form.password,
      }),
    onSuccess: () => {
      navigate("/portal/login", { state: { justReset: true } });
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Could not reset password. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    reset.mutate();
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            H
          </div>
          <div>
            <p className="text-base font-semibold text-navy-900 dark:text-white">Hamdan ERP</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">Customer Portal</p>
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-navy-950 dark:text-white">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Verify your identity with your mobile number and CNIC, then set a new password.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="mobile">Mobile Number</Label>
            <Input
              id="mobile"
              required
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              placeholder="03xxxxxxxxx"
              autoComplete="tel"
            />
          </div>

          <div>
            <Label htmlFor="cnic">CNIC</Label>
            <Input
              id="cnic"
              required
              value={form.cnic}
              onChange={(e) => setForm({ ...form, cnic: e.target.value })}
              placeholder="xxxxx-xxxxxxx-x"
            />
          </div>

          <div>
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                id="password"
                type="password"
                className="pl-9"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
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

          <Button type="submit" className="w-full" disabled={reset.isPending}>
            {reset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Remembered your password?{" "}
          <Link to="/portal/login" className="font-medium text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
