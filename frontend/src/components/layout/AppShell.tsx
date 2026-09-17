import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const titles: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/units": "Units",
  "/land-plots": "Land / Plots",
  "/leads": "Leads",
  "/customers": "Customers & Allottees",
  "/accounts": "Chart of Accounts",
  "/vouchers": "Vouchers",
  "/bookings": "Unit Booking",
  "/rentals": "Rentals",
  "/receipts": "Receipts",
  "/brokers": "Broker Commissions",
  "/partners": "Investor / Partners",
  "/reports": "Financial Reports",
  "/refunds": "Refunds",
  "/expenses": "Expense Management",
};

export function AppShell() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const title =
    Object.entries(titles).find(([path]) =>
      path === "/" ? location.pathname === "/" : location.pathname.startsWith(path),
    )?.[1] ?? "Hamdan ERP";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
