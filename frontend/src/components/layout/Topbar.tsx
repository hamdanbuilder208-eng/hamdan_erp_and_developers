import { LogOut, Moon, Search, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useThemeStore } from "../../store/themeStore";

export function Topbar({ title }: { title: string }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = (user?.full_name || user?.username || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-navy-800 dark:bg-navy-900">
      <div>
        <h1 className="text-lg font-semibold text-navy-900 dark:text-white">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            placeholder="Search..."
            className="h-9 w-64 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-navy-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <button
          onClick={toggleTheme}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-navy-700 dark:text-slate-400 dark:hover:bg-navy-800 dark:hover:text-white"
        >
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-navy-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            {initials}
          </div>
          <div className="hidden text-sm md:block">
            <p className="font-medium text-navy-900 dark:text-slate-100">
              {user?.full_name || user?.username}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-danger-500 dark:hover:bg-navy-800"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
