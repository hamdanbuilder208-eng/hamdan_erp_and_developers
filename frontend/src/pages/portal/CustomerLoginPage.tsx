import * as React from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Loader2, Lock, Phone } from "lucide-react";
import { portalApi } from "../../lib/portalApi";
import { useCustomerAuthStore } from "../../store/customerAuthStore";
import { Button } from "../../components/ui/Button";
import { Input, Label } from "../../components/ui/Input";
import type { CustomerAccount } from "../../types";

export default function CustomerLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useCustomerAuthStore((s) => s.setSession);

  const [mobile, setMobile] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const navState = location.state as { justSignedUp?: boolean; justReset?: boolean } | null;
  const justSignedUp = Boolean(navState?.justSignedUp);
  const justReset = Boolean(navState?.justReset);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const form = new URLSearchParams();
      form.set("username", mobile);
      form.set("password", password);
      const { data: tokenData } = await portalApi.post("/portal/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { data: account } = await portalApi.get<CustomerAccount>("/portal/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      setSession(tokenData.access_token, account);
      navigate("/portal");
    } catch {
      setError("Incorrect mobile number or password.");
    } finally {
      setLoading(false);
    }
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

        <h1 className="text-2xl font-semibold text-navy-950 dark:text-white">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          View your booking, payment schedule and receipts.
        </p>

        {justSignedUp && (
          <p className="mt-4 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
            Account created — sign in below.
          </p>
        )}
        {justReset && (
          <p className="mt-4 rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700">
            Password reset — sign in with your new password.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="mobile">Mobile Number</Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                id="mobile"
                className="pl-9"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                autoComplete="tel"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/portal/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                id="password"
                type="password"
                className="pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Don't have an account yet?{" "}
          <Link to="/portal/signup" className="font-medium text-brand-600 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
