import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User as UserIcon } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import hamdanLogo from "../assets/hamdan-logo-full.png";
import { Button } from "../components/ui/Button";
import { Label } from "../components/ui/Input";
import type { User } from "../types";

function SkylineBackdrop() {
  const bars = [18, 34, 24, 46, 30, 60, 38, 50, 26, 42];
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full opacity-[0.06]"
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {bars.map((h, i) => (
        <rect key={i} x={i * 40} y={100 - h} width={28} height={h} fill="#eac54f" />
      ))}
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [username, setUsername] = React.useState("admin");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#05070c] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(234,197,79,0.10), transparent 55%), radial-gradient(circle at 85% 85%, rgba(169,116,23,0.12), transparent 50%)",
        }}
      />

      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#05070c]/85 backdrop-blur-sm">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "conic-gradient(from 0deg, transparent 0%, rgba(234,197,79,0.9) 100%)",
                animation: "erp-ring-spin 1.1s linear infinite",
                WebkitMask:
                  "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))",
              }}
            />
            <img src={hamdanLogo} alt="Hamdan" className="h-11 w-11 rounded-xl object-cover" />
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

      <div className="relative z-10 w-full max-w-[360px]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0d1017] to-[#070911] p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
          <SkylineBackdrop />

          <div className="relative z-10 flex flex-col items-center text-center">
            <img src={hamdanLogo} alt="Hamdan Builders and Developers" className="h-16 w-16 rounded-xl object-cover" />

            <h1 className="mt-3 text-lg font-bold tracking-tight text-white">Welcome Back</h1>
            <p className="mt-0.5 text-xs text-slate-400">Sign in to your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="relative z-10 mt-5 space-y-3">
            <div>
              <Label htmlFor="username" className="text-slate-300">
                Username
              </Label>
              <div className="relative mt-1">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="username"
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-[#eac54f]/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-[#eac54f]/20"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-300">
                Password
              </Label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="h-10 w-full rounded-lg border border-white/10 bg-white/5 pl-9 pr-9 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-[#eac54f]/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-[#eac54f]/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-lg border-0 bg-gradient-to-r from-[#eac54f] to-[#a97417] text-[#1a1408] font-bold shadow-lg shadow-[#a97417]/20 hover:brightness-105"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Log In
            </Button>
          </form>

          <div className="relative z-10 my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Or</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            type="button"
            onClick={() => navigate("/portal/login")}
            className="relative z-10 h-10 w-full rounded-lg border border-white/15 bg-transparent text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            Access Customer Portal
          </Button>

          <div className="relative z-10 mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-[#eac54f]" />
            Secure &amp; Trusted Access
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Built by{" "}
          <a
            href="mailto:rafaysyed819@gmail.com"
            className="font-medium text-slate-400 hover:text-[#eac54f] hover:underline"
          >
            Syed Rafay Ali
          </a>
        </p>
      </div>
    </div>
  );
}
