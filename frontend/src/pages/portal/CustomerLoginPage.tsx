import * as React from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Building2, CalendarClock, Home, Loader2, Lock, Phone, Receipt, ShieldCheck } from "lucide-react";
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
    <div className="flex min-h-screen w-full">
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-navy-950/80 backdrop-blur-sm">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0%, rgba(52,104,240,0.9) 100%)",
                animation: "erp-ring-spin 1.1s linear infinite",
                WebkitMask:
                  "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))",
              }}
            />
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-900/50">
              H
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-white">Signing in</p>
            <p className="text-xs text-slate-400">Verifying your account…</p>
          </div>
          <style>{`
            @keyframes erp-ring-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-950 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(52,104,240,0.35), transparent 45%), radial-gradient(circle at 80% 70%, rgba(52,104,240,0.25), transparent 40%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-lg shadow-brand-900/50">
            H
          </div>
          <p className="text-lg font-semibold">Hamdan Associates</p>
        </div>

        <div className="relative z-10 space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-300 ring-1 ring-inset ring-brand-400/30">
            <Home className="h-3.5 w-3.5" />
            Customer Portal
          </span>
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Welcome back — your property, your progress, right here.
          </h2>
          <p className="max-w-sm text-sm text-slate-400">
            Everything about your booking with Hamdan Associates, whenever you need it.
          </p>
          <ul className="space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-2.5">
              <CalendarClock className="h-4 w-4 shrink-0 text-brand-400" />
              See your installment schedule and what's due next
            </li>
            <li className="flex items-center gap-2.5">
              <Receipt className="h-4 w-4 shrink-0 text-brand-400" />
              Pull up any past payment receipt in seconds
            </li>
            <li className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 shrink-0 text-brand-400" />
              Check your unit, project and booking status at a glance
            </li>
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-brand-400" />
          Your account is private and only visible to you
        </div>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-surface px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
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

          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-navy-800">
            <p className="mb-2 text-center text-xs text-slate-400 dark:text-slate-500">
              Staff member?
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Go to Admin Panel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
