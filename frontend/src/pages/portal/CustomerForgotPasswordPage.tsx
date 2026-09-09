import * as React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { portalApi } from "../../lib/portalApi";
import { Button } from "../../components/ui/Button";
import { Label } from "../../components/ui/Input";
import hamdanLogo from "../../assets/hamdan-logo-full.png";

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

const inputClass =
  "h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-[#eac54f]/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-[#eac54f]/20";

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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#05070c] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, rgba(234,197,79,0.10), transparent 55%), radial-gradient(circle at 85% 85%, rgba(169,116,23,0.12), transparent 50%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[360px]">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0d1017] to-[#070911] p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
          <SkylineBackdrop />

          <div className="relative z-10 flex flex-col items-center text-center">
            <img src={hamdanLogo} alt="Hamdan Associates" className="h-16 w-16 rounded-xl object-cover" />
            <h1 className="mt-3 text-lg font-bold tracking-tight text-white">Reset Your Password</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Verify your identity with your mobile number and CNIC, then set a new password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative z-10 mt-5 space-y-3">
            <div>
              <Label htmlFor="mobile" className="text-slate-300">
                Mobile Number
              </Label>
              <input
                id="mobile"
                required
                className={`mt-1 ${inputClass}`}
                value={form.mobile}
                onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                placeholder="03xxxxxxxxx"
                autoComplete="tel"
              />
            </div>

            <div>
              <Label htmlFor="cnic" className="text-slate-300">
                CNIC
              </Label>
              <input
                id="cnic"
                required
                className={`mt-1 ${inputClass}`}
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: e.target.value })}
                placeholder="xxxxx-xxxxxxx-x"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-slate-300">
                New Password
              </Label>
              <div className="relative mt-1">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type="password"
                  className={`pl-9 ${inputClass}`}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="confirm" className="text-slate-300">
                Confirm New Password
              </Label>
              <input
                id="confirm"
                type="password"
                required
                className={`mt-1 ${inputClass}`}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-danger-500/20 bg-danger-500/10 px-3 py-2 text-sm text-danger-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={reset.isPending}
              className="h-10 w-full rounded-lg border-0 bg-gradient-to-r from-[#eac54f] to-[#a97417] text-[#1a1408] font-bold shadow-lg shadow-[#a97417]/20 hover:brightness-105"
            >
              {reset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </form>

          <p className="relative z-10 mt-4 text-center text-xs text-slate-400">
            Remembered your password?{" "}
            <Link to="/portal/login" className="font-medium text-[#eac54f] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
