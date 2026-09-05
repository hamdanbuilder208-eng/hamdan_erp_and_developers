import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Layers,
  Users,
  UserCog,
  Wallet,
  Handshake,
  Boxes,
  Receipt,
  BarChart3,
  ShieldCheck,
  Lock,
  MapPin,
  FileText,
  Landmark,
  MessageCircle,
  Settings,
  Undo2,
  Wallet2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/authStore";

const activeModules: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  moduleKey?: string | null;
}[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, moduleKey: null },
  { to: "/projects", label: "Projects & Units", icon: Building2, moduleKey: "projects" },
  { to: "/land-plots", label: "Land / Plots", icon: MapPin, moduleKey: "land_properties" },
  { to: "/customers", label: "Customers & Allottees", icon: Users, moduleKey: "allottees" },
  { to: "/bookings", label: "Unit Booking", icon: Layers, moduleKey: "bookings" },
  { to: "/receipts", label: "Receipts", icon: Receipt, moduleKey: "receipts" },
  { to: "/refunds", label: "Refunds", icon: Undo2, moduleKey: "refunds" },
  { to: "/accounts", label: "Chart of Accounts", icon: Wallet, moduleKey: "accounts" },
  { to: "/vouchers", label: "Vouchers", icon: FileText, moduleKey: "vouchers" },
  { to: "/brokers", label: "Broker Commissions", icon: Handshake, moduleKey: "booking_agents" },
  { to: "/partners", label: "Investor / Partners", icon: Landmark, moduleKey: "partners" },
  { to: "/reports", label: "Financial Reports", icon: BarChart3, moduleKey: "reports" },
  { to: "/expenses", label: "Expense Management", icon: Wallet2, moduleKey: "expenses" },
  { to: "/material-inventory", label: "Material & Inventory", icon: Boxes, moduleKey: "inventory" },
  { to: "/communications", label: "WhatsApp / SMS", icon: MessageCircle, moduleKey: "communications" },
];

const upcomingModules: { label: string; icon: typeof Boxes }[] = [];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role?.is_admin;

  const modules = activeModules.filter(
    (item) => isAdmin || !item.moduleKey || role?.allowed_modules.includes(item.moduleKey),
  );
  const withAdminEntries = isAdmin
    ? [
        ...modules,
        { to: "/users", label: "Users & Roles", icon: UserCog },
        { to: "/admin", label: "Admin Utilities", icon: Settings },
      ]
    : modules;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col overflow-hidden bg-navy-950 text-slate-200 transition-all duration-200 ease-in-out",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-2.5 px-5 py-5", collapsed && "justify-center px-0")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 font-bold text-white shadow-lg shadow-brand-900/40">
          H
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Hamdan ERP</p>
            <p className="truncate text-[11px] text-slate-400">Real Estate Management</p>
          </div>
        )}
      </div>

      <div className={cn("px-3 pb-2", collapsed && "flex justify-center px-0")}>
        <button
          onClick={onToggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden px-3 py-2", collapsed && "px-2")}>
        {!collapsed && (
          <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Active
          </p>
        )}
        <ul className="space-y-0.5">
          {withAdminEntries.map((item) => (
            <li key={item.label}>
              <NavLink
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-brand-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {upcomingModules.length > 0 && (
          <>
            {!collapsed && (
              <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Coming up
              </p>
            )}
            <ul className="space-y-0.5">
              {upcomingModules.map((item) => (
                <li key={item.label}>
                  <div
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex cursor-not-allowed items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-500",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                    {!collapsed && <Lock className="ml-auto h-3 w-3" />}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      <div
        className={cn(
          "flex items-center gap-2 whitespace-nowrap border-t border-white/10 px-5 py-4 text-[11px] text-slate-400",
          collapsed && "justify-center px-0",
        )}
        title={collapsed ? "Role-based access enabled" : undefined}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-400" />
        {!collapsed && "Role-based access enabled"}
      </div>
    </aside>
  );
}
