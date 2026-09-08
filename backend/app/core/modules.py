"""Fixed list of grantable modules for role-based permissions. Keys are what
gets stored in RoleModulePermission and checked by require_module_access();
labels are for the frontend's checkbox list (GET /users/modules).

User/role management and Admin Utilities are deliberately NOT here — those stay
is_admin-only always, never individually grantable to a custom role."""

MODULE_KEYS: dict[str, str] = {
    "projects": "Projects & Units",
    "land_properties": "Land / Plots",
    "allottees": "Customers & Allottees",
    "bookings": "Unit Booking",
    "receipts": "Receipts",
    "refunds": "Refunds",
    "accounts": "Chart of Accounts",
    "vouchers": "Vouchers",
    "booking_agents": "Broker Commissions",
    "partners": "Investor / Partners",
    "reports": "Financial Reports",
    "expenses": "Expense Management",
    "inventory": "Material & Inventory",
    "petty_cash": "Petty Cash",
    "communications": "WhatsApp / SMS",
}
