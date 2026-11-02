"""Period report: any one category of transactions (material purchases,
customer receipts, expenses...) totalled per day / week / month / year, with
filters for project, item, payment mode and party, optionally split by one of
those. e.g. "cement bags bought for project X in cash, month by month".

Each category is first flattened into plain Entry rows so filtering, grouping
and totalling work the same way for all of them."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session, joinedload

from app.models.booking import Booking
from app.models.commission_payout import CommissionPayout
from app.models.contractor import ContractAgreement, ContractorPayment
from app.models.expense import OfficeExpense, WagePayment
from app.models.inventory import GRN, GRNLine, MaterialIssue, MaterialIssueLine
from app.models.petty_cash import PettyCashExpense
from app.models.receipt import ChequeStatus, Receipt
from app.models.rental import RentAgreement, RentReceipt
from app.schemas.report import (
    PeriodReport,
    PeriodReportCategory,
    PeriodReportGroupBy,
    PeriodReportPeriod,
    PeriodReportRow,
)

CATEGORY_LABELS: dict[str, str] = {
    "material_purchases": "Material Purchases",
    "material_issues": "Material Issued to Projects",
    "customer_receipts": "Customer Receipts",
    "expenses": "Office / Project Expenses",
    "contractor_payments": "Contractor Payments",
    "wages": "Wages / Salaries",
    "rent_received": "Rent Received",
    "commission_paid": "Broker Commission Paid",
}
# Categories where a quantity (and its unit) is meaningful per item.
QUANTITY_CATEGORIES = {"material_purchases", "material_issues"}


@dataclass
class Entry:
    date: date
    amount: float
    project: str | None = None
    project_id: int | None = None
    item: str | None = None
    unit: str | None = None
    quantity: float | None = None
    party: str | None = None
    payment_mode: str | None = None


def _project_name(project) -> str | None:
    return project.project_name if project else None


# ---- one loader per category -------------------------------------------------


def _material_purchases(db: Session, d_from: date | None, d_to: date | None) -> list[Entry]:
    q = (
        db.query(GRNLine)
        .join(GRN, GRNLine.grn_id == GRN.id)
        .options(
            joinedload(GRNLine.material),
            joinedload(GRNLine.grn).joinedload(GRN.vendor),
            joinedload(GRNLine.grn).joinedload(GRN.project),
        )
    )
    if d_from:
        q = q.filter(GRN.grn_date >= d_from)
    if d_to:
        q = q.filter(GRN.grn_date <= d_to)
    entries = [
        Entry(
            date=l.grn.grn_date,
            amount=float(l.amount),
            project=_project_name(l.grn.project),
            project_id=l.grn.project_id,
            item=l.material.name,
            unit=l.material.unit_of_measure,
            quantity=float(l.quantity),
            party=l.grn.vendor.name,
            payment_mode=l.grn.mode_of_payment,
        )
        for l in q.all()
    ]

    # Material bought out of petty cash counts as a purchase too.
    pq = (
        db.query(PettyCashExpense)
        .options(
            joinedload(PettyCashExpense.material),
            joinedload(PettyCashExpense.project),
            joinedload(PettyCashExpense.float),
        )
        .filter(PettyCashExpense.material_id.isnot(None))
    )
    if d_from:
        pq = pq.filter(PettyCashExpense.expense_date >= d_from)
    if d_to:
        pq = pq.filter(PettyCashExpense.expense_date <= d_to)
    entries += [
        Entry(
            date=e.expense_date,
            amount=float(e.amount),
            project=_project_name(e.project),
            project_id=e.project_id,
            item=e.material.name,
            unit=e.material.unit_of_measure,
            quantity=float(e.quantity) if e.quantity is not None else None,
            party=e.float.holder_name if e.float else None,
            payment_mode="Petty Cash",
        )
        for e in pq.all()
    ]
    return entries


def _material_issues(db: Session, d_from: date | None, d_to: date | None) -> list[Entry]:
    q = (
        db.query(MaterialIssueLine)
        .join(MaterialIssue, MaterialIssueLine.issue_id == MaterialIssue.id)
        .options(
            joinedload(MaterialIssueLine.material),
            joinedload(MaterialIssueLine.material_issue).joinedload(MaterialIssue.project),
        )
    )
    if d_from:
        q = q.filter(MaterialIssue.issue_date >= d_from)
    if d_to:
        q = q.filter(MaterialIssue.issue_date <= d_to)
    return [
        Entry(
            date=l.material_issue.issue_date,
            amount=float(l.amount),
            project=_project_name(l.material_issue.project),
            project_id=l.material_issue.project_id,
            item=l.material.name,
            unit=l.material.unit_of_measure,
            quantity=float(l.quantity),
            party=l.material_issue.issued_to,
        )
        for l in q.all()
    ]


def _customer_receipts(db: Session, d_from: date | None, d_to: date | None) -> list[Entry]:
    q = db.query(Receipt).options(
        joinedload(Receipt.booking).joinedload(Booking.project),
        joinedload(Receipt.booking).joinedload(Booking.allottee),
    )
    # A bounced cheque was never actually received.
    q = q.filter((Receipt.cheque_status.is_(None)) | (Receipt.cheque_status != ChequeStatus.BOUNCED))
    if d_from:
        q = q.filter(Receipt.receipt_date >= d_from)
    if d_to:
        q = q.filter(Receipt.receipt_date <= d_to)
    return [
        Entry(
            date=r.receipt_date,
            amount=float(r.amount),
            project=_project_name(r.booking.project),
            project_id=r.booking.project_id,
            item=r.payment_type.value,
            party=r.booking.allottee.name,
            payment_mode=r.mode_of_payment,
        )
        for r in q.all()
    ]


def _expenses(db: Session, d_from: date | None, d_to: date | None) -> list[Entry]:
    q = db.query(OfficeExpense).options(
        joinedload(OfficeExpense.expense_head), joinedload(OfficeExpense.project)
    )
    if d_from:
        q = q.filter(OfficeExpense.expense_date >= d_from)
    if d_to:
        q = q.filter(OfficeExpense.expense_date <= d_to)
    return [
        Entry(
            date=e.expense_date,
            amount=float(e.amount),
            project=_project_name(e.project),
            project_id=e.project_id,
            item=e.expense_head.name,
            payment_mode=e.mode_of_payment,
        )
        for e in q.all()
    ]


def _contractor_payments(db: Session, d_from: date | None, d_to: date | None) -> list[Entry]:
    q = db.query(ContractorPayment).options(
        joinedload(ContractorPayment.agreement).joinedload(ContractAgreement.project),
        joinedload(ContractorPayment.agreement).joinedload(ContractAgreement.contractor),
    )
    if d_from:
        q = q.filter(ContractorPayment.payment_date >= d_from)
    if d_to:
        q = q.filter(ContractorPayment.payment_date <= d_to)
    return [
        Entry(
            date=p.payment_date,
            amount=float(p.amount),
            project=_project_name(p.agreement.project),
            project_id=p.agreement.project_id,
            item=p.agreement.work_type,
            party=p.agreement.contractor.name,
            payment_mode=p.mode_of_payment,
        )
        for p in q.all()
    ]


def _wages(db: Session, d_from: date | None, d_to: date | None) -> list[Entry]:
    q = db.query(WagePayment).options(joinedload(WagePayment.employee))
    if d_from:
        q = q.filter(WagePayment.payment_date >= d_from)
    if d_to:
        q = q.filter(WagePayment.payment_date <= d_to)
    return [
        Entry(
            date=w.payment_date,
            amount=float(w.net_paid),
            item=w.employee.designation,
            party=w.employee.name,
            payment_mode=w.mode_of_payment,
        )
        for w in q.all()
    ]


def _rent_received(db: Session, d_from: date | None, d_to: date | None) -> list[Entry]:
    q = db.query(RentReceipt).options(
        joinedload(RentReceipt.agreement).joinedload(RentAgreement.tenant),
        joinedload(RentReceipt.agreement).joinedload(RentAgreement.unit),
        joinedload(RentReceipt.agreement).joinedload(RentAgreement.land_property),
    )
    if d_from:
        q = q.filter(RentReceipt.receipt_date >= d_from)
    if d_to:
        q = q.filter(RentReceipt.receipt_date <= d_to)
    entries = []
    for r in q.all():
        a = r.agreement
        if a.unit:
            item = f"Unit {a.unit.unit_number}"
            project_id = a.unit.project_id
        else:
            item = f"{a.land_property.property_ref_no} — {a.land_property.area_location}" if a.land_property else None
            project_id = None
        entries.append(
            Entry(
                date=r.receipt_date,
                amount=float(r.amount),
                project_id=project_id,
                item=item,
                party=a.tenant.name,
                payment_mode=r.mode_of_payment,
            )
        )
    _fill_project_names(db, entries)
    return entries


def _commission_paid(db: Session, d_from: date | None, d_to: date | None) -> list[Entry]:
    q = db.query(CommissionPayout).options(
        joinedload(CommissionPayout.booking).joinedload(Booking.project),
        joinedload(CommissionPayout.booking).joinedload(Booking.unit),
        joinedload(CommissionPayout.agent),
    )
    if d_from:
        q = q.filter(CommissionPayout.payout_date >= d_from)
    if d_to:
        q = q.filter(CommissionPayout.payout_date <= d_to)
    return [
        Entry(
            date=p.payout_date,
            amount=float(p.amount),
            project=_project_name(p.booking.project),
            project_id=p.booking.project_id,
            item=f"{p.booking.booking_ref_no} · {p.booking.unit.unit_number}",
            party=p.agent.name,
            payment_mode=p.mode_of_payment,
        )
        for p in q.all()
    ]


def _fill_project_names(db: Session, entries: list[Entry]) -> None:
    from app.models.project import Project

    ids = {e.project_id for e in entries if e.project_id and not e.project}
    if not ids:
        return
    names = dict(db.query(Project.id, Project.project_name).filter(Project.id.in_(ids)).all())
    for e in entries:
        if e.project_id and not e.project:
            e.project = names.get(e.project_id)


LOADERS = {
    "material_purchases": _material_purchases,
    "material_issues": _material_issues,
    "customer_receipts": _customer_receipts,
    "expenses": _expenses,
    "contractor_payments": _contractor_payments,
    "wages": _wages,
    "rent_received": _rent_received,
    "commission_paid": _commission_paid,
}


# ---- periods -----------------------------------------------------------------


def period_bounds(d: date, period: str) -> tuple[date, date, str]:
    """(start, end, label) of the day / week (Mon–Sun) / month / year holding d."""
    if period == "day":
        return d, d, d.strftime("%d %b %Y")
    if period == "week":
        start = d - timedelta(days=d.weekday())
        end = start + timedelta(days=6)
        iso_year, iso_week, _ = d.isocalendar()
        return start, end, f"Week {iso_week}, {iso_year} ({start.strftime('%d %b')} – {end.strftime('%d %b')})"
    if period == "month":
        start = d.replace(day=1)
        end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        return start, end, start.strftime("%b %Y")
    start = date(d.year, 1, 1)
    return start, date(d.year, 12, 31), str(d.year)


NONE_LABEL = {
    "project": "No project (office)",
    "item": "—",
    "payment_mode": "—",
    "party": "—",
}


def get_period_report(
    db: Session,
    category: PeriodReportCategory,
    period: PeriodReportPeriod,
    date_from: date | None = None,
    date_to: date | None = None,
    project_id: int | None = None,
    item: str | None = None,
    payment_mode: str | None = None,
    party: str | None = None,
    group_by: PeriodReportGroupBy | None = None,
) -> PeriodReport:
    all_entries = LOADERS[category](db, date_from, date_to)

    # Filter options come from the whole date range, before the other filters,
    # so picking one filter doesn't empty the other dropdowns.
    items = sorted({e.item for e in all_entries if e.item})
    parties = sorted({e.party for e in all_entries if e.party})
    modes = sorted({e.payment_mode for e in all_entries if e.payment_mode})

    entries = [
        e
        for e in all_entries
        if (project_id is None or e.project_id == project_id)
        and (item is None or e.item == item)
        and (payment_mode is None or e.payment_mode == payment_mode)
        and (party is None or e.party == party)
    ]

    buckets: dict[tuple[date, str | None], dict] = defaultdict(
        lambda: {"count": 0, "amount": 0.0, "quantity": 0.0, "units": set()}
    )
    labels: dict[date, tuple[date, str]] = {}
    for e in entries:
        start, end, label = period_bounds(e.date, period)
        labels[start] = (end, label)
        group = None
        if group_by:
            group = getattr(e, group_by) or NONE_LABEL[group_by]
        b = buckets[(start, group)]
        b["count"] += 1
        b["amount"] += e.amount
        if e.quantity is not None:
            b["quantity"] += e.quantity
        if e.unit:
            b["units"].add(e.unit)

    has_quantity = category in QUANTITY_CATEGORIES
    rows = []
    for (start, group), b in sorted(buckets.items(), key=lambda kv: (kv[0][0], kv[0][1] or "")):
        end, label = labels[start]
        # Quantities only add up when they're all in one unit (e.g. one material).
        single_unit = len(b["units"]) == 1
        rows.append(
            PeriodReportRow(
                period_start=start,
                period_end=end,
                period_label=label,
                group=group,
                count=b["count"],
                quantity=round(b["quantity"], 2) if has_quantity and single_unit else None,
                unit=next(iter(b["units"])) if has_quantity and single_unit else None,
                amount=round(b["amount"], 2),
            )
        )

    all_units = {e.unit for e in entries if e.unit}
    total_single_unit = has_quantity and len(all_units) == 1
    return PeriodReport(
        category=category,
        category_label=CATEGORY_LABELS[category],
        period=period,
        group_by=group_by,
        rows=rows,
        total_count=len(entries),
        total_quantity=(
            round(sum(e.quantity or 0 for e in entries), 2) if total_single_unit else None
        ),
        total_unit=next(iter(all_units)) if total_single_unit else None,
        total_amount=round(sum(e.amount for e in entries), 2),
        items=items,
        parties=parties,
        payment_modes=modes,
    )
