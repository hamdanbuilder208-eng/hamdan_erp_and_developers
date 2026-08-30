import { LogOut } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useCustomerAuthStore } from "../../store/customerAuthStore";
import { cn } from "../../lib/utils";

export function PortalShell() {
  const account = useCustomerAuthStore((s) => s.account);
  const logout = useCustomerAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/portal/login");
  };

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-slate-200 bg-white dark:border-navy-800 dark:bg-navy-900">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
              H
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900 dark:text-white">Hamdan ERP</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Customer Portal</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            <NavLink
              to="/portal"
              end
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-slate-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white",
                )
              }
            >
              My Account
            </NavLink>
            <NavLink
              to="/portal/receipts"
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-slate-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white",
                )
              }
            >
              My Receipts
            </NavLink>
            <NavLink
              to="/portal/change-password"
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-slate-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-white",
                )
              }
            >
              Change Password
            </NavLink>
            <button
              onClick={handleLogout}
              title="Logout"
              className="ml-2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-danger-500 dark:hover:bg-navy-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Welcome, <span className="font-medium text-navy-800 dark:text-slate-200">{account?.allottee.name}</span>
          </p>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
