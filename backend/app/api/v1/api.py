from fastapi import APIRouter, Depends

from app.api.deps import get_current_admin_user, get_current_user, require_module_access
from app.api.v1.endpoints import (
    accounts,
    admin,
    allottees,
    auth,
    booking_agents,
    bookings,
    commission_payouts,
    communications,
    expenses,
    inventory,
    land_properties,
    leads,
    rentals,
    partner_contributions,
    partner_drawings,
    partner_expenses,
    partners,
    petty_cash,
    portal,
    projects,
    receipts,
    refunds,
    reports,
    search,
    unit_categories,
    units,
    uploads,
    users,
    vouchers,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(portal.router, prefix="/portal", tags=["Customer Portal"])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(
    users.router, prefix="/users", tags=["Users & Roles"]
)
api_router.include_router(
    projects.router,
    prefix="/projects",
    tags=["Projects"],
    dependencies=[Depends(require_module_access("projects"))],
)
api_router.include_router(
    unit_categories.router,
    prefix="/unit-categories",
    tags=["Unit Categories"],
    dependencies=[Depends(require_module_access("projects"))],
)
api_router.include_router(
    units.router,
    prefix="/units",
    tags=["Units"],
    dependencies=[Depends(require_module_access("projects"))],
)
api_router.include_router(
    land_properties.router,
    prefix="/land-properties",
    tags=["Land / Plot Inventory"],
    dependencies=[Depends(require_module_access("land_properties"))],
)
api_router.include_router(
    allottees.router,
    prefix="/allottees",
    tags=["Customers & Allottees"],
    dependencies=[Depends(require_module_access("allottees"))],
)
api_router.include_router(
    accounts.router,
    prefix="/accounts",
    tags=["Chart of Accounts"],
    dependencies=[Depends(require_module_access("accounts"))],
)
api_router.include_router(
    vouchers.router,
    prefix="/vouchers",
    tags=["Vouchers"],
    dependencies=[Depends(require_module_access("vouchers"))],
)
api_router.include_router(
    bookings.router,
    prefix="/bookings",
    tags=["Unit Booking"],
    dependencies=[Depends(require_module_access("bookings"))],
)
api_router.include_router(
    receipts.router,
    prefix="/receipts",
    tags=["Receipts"],
    dependencies=[Depends(require_module_access("receipts"))],
)
api_router.include_router(
    booking_agents.router,
    prefix="/booking-agents",
    tags=["Booking Agents"],
    dependencies=[Depends(require_module_access("booking_agents"))],
)
api_router.include_router(
    commission_payouts.router,
    prefix="/commission-payouts",
    tags=["Commission Payouts"],
    dependencies=[Depends(require_module_access("booking_agents"))],
)
api_router.include_router(
    partners.router,
    prefix="/partners",
    tags=["Investors / Partners"],
    dependencies=[Depends(require_module_access("partners"))],
)
api_router.include_router(
    partner_drawings.router,
    prefix="/partner-drawings",
    tags=["Partner Drawings"],
    dependencies=[Depends(require_module_access("partners"))],
)
api_router.include_router(
    partner_contributions.router,
    prefix="/partner-contributions",
    tags=["Partner Contributions"],
    dependencies=[Depends(require_module_access("partners"))],
)
api_router.include_router(
    partner_expenses.router,
    prefix="/partner-expenses",
    tags=["Partner Expenses"],
    dependencies=[Depends(require_module_access("partners"))],
)
api_router.include_router(
    reports.router,
    prefix="/reports",
    tags=["Financial Reports"],
    dependencies=[Depends(require_module_access("reports"))],
)
api_router.include_router(
    refunds.router,
    prefix="/refunds",
    tags=["Refunds"],
    dependencies=[Depends(require_module_access("refunds"))],
)
api_router.include_router(
    expenses.router,
    prefix="/expenses",
    tags=["Expenses"],
    dependencies=[Depends(require_module_access("expenses"))],
)
api_router.include_router(
    inventory.router,
    prefix="/inventory",
    tags=["Material & Inventory"],
    dependencies=[Depends(require_module_access("inventory"))],
)
api_router.include_router(
    petty_cash.router,
    prefix="/petty-cash",
    tags=["Petty Cash"],
    dependencies=[Depends(require_module_access("petty_cash"))],
)
api_router.include_router(
    communications.router,
    prefix="/communications",
    tags=["WhatsApp / SMS"],
    dependencies=[Depends(require_module_access("communications"))],
)
api_router.include_router(
    leads.router,
    prefix="/leads",
    tags=["Leads"],
    dependencies=[Depends(require_module_access("leads"))],
)
api_router.include_router(
    rentals.router,
    prefix="/rentals",
    tags=["Rentals"],
    dependencies=[Depends(require_module_access("rentals"))],
)
api_router.include_router(
    admin.router,
    prefix="/admin",
    tags=["Admin Utilities"],
    dependencies=[Depends(get_current_user)],
)
api_router.include_router(
    uploads.router,
    prefix="/uploads",
    tags=["Uploads"],
)
