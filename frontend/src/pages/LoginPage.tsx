import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, Lock, ShieldCheck, User as UserIcon } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { Button } from "../components/ui/Button";
import { Input, Label } from "../components/ui/Input";
import type { User } from "../types";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const form = new URLSearchParams();
      form.set("username", username);
      form.set("password", password);
      const { data: tokenData } = await api.post("/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const { data: user } = await api.get<User>("/auth/me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      setSession(tokenData.access_token, user);
      navigate("/");
    } catch {
      setError("Invalid username or password.");
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
            <p className="text-xs text-slate-400">Verifying your credentials…</p>
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
          <div>
            <p className="text-lg font-semibold">Hamdan ERP</p>
            <p className="text-xs text-slate-400">Hamdan Associates</p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <Building2 className="h-10 w-10 text-brand-400" />
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            One system for every project, plot and payment.
          </h2>
          <p className="max-w-sm text-sm text-slate-400">
            Manage projects, units, bookings, installments, brokers and
            accounts &mdash; all in a single, secure ERP built for real estate
            developers.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-brand-400" />
          Secured with role-based access control
        </div>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-surface px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
                H
              </div>
              <p className="text-base font-semibold text-navy-900 dark:text-white">Hamdan ERP</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-navy-950 dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Sign in to your account to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <Input
                  id="username"
                  className="pl-9"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
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
              <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
            Default admin:{" "}
            <span className="font-medium text-slate-500 dark:text-slate-400">admin</span> /{" "}
            <span className="font-medium text-slate-500 dark:text-slate-400">Admin@123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
