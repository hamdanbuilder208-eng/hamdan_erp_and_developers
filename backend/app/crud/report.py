from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.crud import booking_agent as agent_crud
from app.crud import expense as expense_crud
from app.crud import inventory as inventory_crud
from app.crud import partner as partner_crud
from app.models.account import Account, AccountNature
from app.models.allottee import Allottee
from app.models.booking import Booking, BookingStatus
from app.models.expense import OfficeExpense, WagePayment
from app.models.inventory import (
    GRN,
    GRNLine,
    Material,
    MaterialIssue,
    MaterialIssueLine,
    StockLedger,
    StockMovementType,
)
from app.models.land_property import LandProperty, LandPropertyPaymentDirection, LandPropertyStatus
from app.models.project import Project
from app.models.rental import RentAgreement, RentAgreementStatus, RentReceipt
from app.models.voucher import Voucher, VoucherLine
from app.schemas.report import (
    AgingReport,
    AgingRow,
    BalanceSheetLine,
    BalanceSheetReport,
    BrokerSummaryRow,
    CustomerWiseReport,
    CustomerWiseRow,
    EmployeeSummaryRow,
    GeneralLedgerLine,
    GeneralLedgerReport,
    LandPropertyReportRow,
    MaterialSummaryRow,
    PartnerSummaryRow,
    ProfitLossLine,
    ProfitLossReport,
    RentalIncomeRow,
    SalesPurchaseReport,
    StockLedgerReport,
    StockLedgerRow,
    TrialBalanceReport,
    TrialBalanceRow,
)


SCOPE_OFFICE = "office"  # entries with no project and no land property
SCOPE_LAND = "land"  # entries tagged to a Land & Plots property
SCOPE_LABELS = {SCOPE_OFFICE: "Office / General", SCOPE_LAND: "Land & Plots"}


def _is_scoped(project_id: int | None, scope: str | None) -> bool:
    """A project or office/land view only counts its own vouchers — opening
    balances are company-wide, so they're left out (every voucher balances
    on its own, so the figures still balance)."""
    return project_id is not None or scope in SCOPE_LABELS


def _filter_vouchers(query, project_id: int | None, scope: str | None):
    """`query` must already be joined to Voucher."""
    if project_id is not None:
        return query.filter(Voucher.project_id == project_id)
    if scope == SCOPE_OFFICE:
        return query.filter(Voucher.project_id.is_(None), Voucher.land_property_id.is_(None))
    if scope == SCOPE_LAND:
        return query.filter(Voucher.land_property_id.is_not(None))
    return query


def _account_balance(
    db: Session, account: Account, project_id: int | None = None, scope: str | None = None
) -> float:
    """Opening + posted. For a project / office / land view, only its own
    vouchers count (see _is_scoped)."""
    query = db.query(VoucherLine).filter(VoucherLine.account_id == account.id)
    if _is_scoped(project_id, scope):
        query = _filter_vouchers(
            query.join(Voucher, VoucherLine.voucher_id == Voucher.id), project_id, scope
        )
    lines = query.all()
    posted_debit = sum(float(l.debit) for l in lines)
    posted_credit = sum(float(l.credit) for l in lines)
    if _is_scoped(project_id, scope):
        return posted_debit - posted_credit
    opening = float(account.opening_debit) - float(account.opening_credit)
    return opening + posted_debit - posted_credit


def get_trial_balance(
    db: Session, project_id: int | None = None, scope: str | None = None
) -> TrialBalanceReport:
    accounts = db.query(Account).filter(Account.is_control == False).order_by(Account.code).all()  # noqa: E712
    rows: list[TrialBalanceRow] = []
    total_debit = 0.0
    total_credit = 0.0
    for acc in accounts:
        balance = _account_balance(db, acc, project_id, scope)
        if abs(balance) < 0.005:
            continue
        debit = balance if balance > 0 else 0
        credit = -balance if balance < 0 else 0
        total_debit += debit
        total_credit += credit
        rows.append(
            TrialBalanceRow(
                account_id=acc.id,
                code=acc.code,
                name=acc.name,
                nature=acc.nature.value,
                debit=round(debit, 2),
                credit=round(credit, 2),
            )
        )
    return TrialBalanceReport(
        rows=rows,
        total_debit=round(total_debit, 2),
        total_credit=round(total_credit, 2),
        is_balanced=abs(total_debit - total_credit) < 0.01,
    )


def _voucher_lines_query(
    db: Session,
    project_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    scope: str | None = None,
):
    query = (
        db.query(VoucherLine)
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .options(joinedload(VoucherLine.account))
    )
    query = _filter_vouchers(query, project_id, scope)
    if date_from is not None:
        query = query.filter(Voucher.voucher_date >= date_from)
    if date_to is not None:
        query = query.filter(Voucher.voucher_date <= date_to)
    return query.all()


def get_profit_loss(
    db: Session,
    project_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    scope: str | None = None,
) -> ProfitLossReport:
    lines = _voucher_lines_query(db, project_id, date_from, date_to, scope)

    revenue_by_account: dict[int, float] = {}
    expense_by_account: dict[int, float] = {}
    account_lookup: dict[int, Account] = {}

    for line in lines:
        account_lookup[line.account_id] = line.account
        if line.account.nature == AccountNature.REVENUE:
            revenue_by_account[line.account_id] = revenue_by_account.get(
                line.account_id, 0
            ) + float(line.credit) - float(line.debit)
        elif line.account.nature == AccountNature.EXPENSE:
            expense_by_account[line.account_id] = expense_by_account.get(
                line.account_id, 0
            ) + float(line.debit) - float(line.credit)

    revenue_lines = [
        ProfitLossLine(account_id=aid, code=account_lookup[aid].code, name=account_lookup[aid].name, amount=round(amt, 2))
        for aid, amt in revenue_by_account.items()
        if abs(amt) > 0.005
    ]
    expense_lines = [
        ProfitLossLine(account_id=aid, code=account_lookup[aid].code, name=account_lookup[aid].name, amount=round(amt, 2))
        for aid, amt in expense_by_account.items()
        if abs(amt) > 0.005
    ]
    revenue_lines.sort(key=lambda l: l.code)
    expense_lines.sort(key=lambda l: l.code)

    total_revenue = round(sum(l.amount for l in revenue_lines), 2)
    total_expense = round(sum(l.amount for l in expense_lines), 2)

    project_name = SCOPE_LABELS.get(scope) if project_id is None else None
    if project_id is not None:
        project = db.query(Project).filter(Project.id == project_id).first()
        project_name = project.project_name if project else None

    return ProfitLossReport(
        revenue_lines=revenue_lines,
        expense_lines=expense_lines,
        total_revenue=total_revenue,
        total_expense=total_expense,
        net_profit=round(total_revenue - total_expense, 2),
        project_id=project_id,
        project_name=project_name,
        date_from=date_from,
        date_to=date_to,
    )


def get_balance_sheet(
    db: Session, project_id: int | None = None, scope: str | None = None
) -> BalanceSheetReport:
    accounts = db.query(Account).filter(Account.is_control == False).order_by(Account.code).all()  # noqa: E712

    assets: list[BalanceSheetLine] = []
    liabilities: list[BalanceSheetLine] = []
    capital: list[BalanceSheetLine] = []

    for acc in accounts:
        balance = _account_balance(db, acc, project_id, scope)
        if abs(balance) < 0.005:
            continue
        line = BalanceSheetLine(account_id=acc.id, code=acc.code, name=acc.name, amount=round(balance, 2))
        if acc.nature == AccountNature.ASSET:
            assets.append(line)
        elif acc.nature == AccountNature.LIABILITY:
            liabilities.append(BalanceSheetLine(**{**line.model_dump(), "amount": round(-balance, 2)}))
        elif acc.nature == AccountNature.CAPITAL:
            capital.append(BalanceSheetLine(**{**line.model_dump(), "amount": round(-balance, 2)}))

    total_assets = round(sum(l.amount for l in assets), 2)
    total_liabilities = round(sum(l.amount for l in liabilities), 2)
    total_capital_before_profit = round(sum(l.amount for l in capital), 2)

    pl = get_profit_loss(db, project_id=project_id, scope=scope)
    retained_earnings = pl.net_profit
    total_capital = round(total_capital_before_profit + retained_earnings, 2)

    return BalanceSheetReport(
        assets=assets,
        liabilities=liabilities,
        capital=capital,
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        total_capital_before_profit=total_capital_before_profit,
        retained_earnings=retained_earnings,
        total_capital=total_capital,
        is_balanced=abs(total_assets - (total_liabilities + total_capital)) < 0.01,
    )


def get_general_ledger(
    db: Session,
    account_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    project_id: int | None = None,
    scope: str | None = None,
) -> GeneralLedgerReport | None:
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return None

    # Opening balances are company-wide, so a project / office / land ledger starts at zero.
    opening_balance = (
        0.0
        if _is_scoped(project_id, scope)
        else float(account.opening_debit) - float(account.opening_credit)
    )

    query = (
        db.query(VoucherLine)
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .options(joinedload(VoucherLine.voucher))
        .filter(VoucherLine.account_id == account_id)
    )
    query = _filter_vouchers(query, project_id, scope)

    running = opening_balance
    if date_from is not None:
        earlier = query.filter(Voucher.voucher_date < date_from).all()
        for l in earlier:
            running += float(l.debit) - float(l.credit)

    filtered_query = query
    if date_from is not None:
        filtered_query = filtered_query.filter(Voucher.voucher_date >= date_from)
    if date_to is not None:
        filtered_query = filtered_query.filter(Voucher.voucher_date <= date_to)

    voucher_lines = filtered_query.order_by(Voucher.voucher_date, Voucher.id).all()

    lines: list[GeneralLedgerLine] = []
    for vl in voucher_lines:
        running += float(vl.debit) - float(vl.credit)
        lines.append(
            GeneralLedgerLine(
                voucher_id=vl.voucher.id,
                voucher_no=vl.voucher.voucher_no,
                voucher_date=vl.voucher.voucher_date,
                voucher_type=vl.voucher.voucher_type.value,
                narration=vl.narration or vl.voucher.narration,
                debit=float(vl.debit),
                credit=float(vl.credit),
                running_balance=round(running, 2),
            )
        )

    return GeneralLedgerReport(
        account_id=account.id,
        account_code=account.code,
        account_name=account.name,
        opening_balance=round(opening_balance, 2),
        lines=lines,
        closing_balance=round(running, 2),
    )


# Aging


def get_aging_report(
    db: Session, as_of_date: date | None = None, project_id: int | None = None
) -> AgingReport:
    if as_of_date is None:
        as_of_date = date.today()

    query = (
        db.query(Booking)
        .options(
            joinedload(Booking.allottee),
            joinedload(Booking.project),
            joinedload(Booking.schedule_lines),
        )
        .filter(Booking.status != BookingStatus.CANCELLED)
    )
    if project_id is not None:
        query = query.filter(Booking.project_id == project_id)
    bookings = query.all()

    rows: list[AgingRow] = []
    total_0_30 = total_31_60 = total_61_90 = total_90_plus = 0.0

    for b in bookings:
        b0 = b1 = b2 = b3 = 0.0
        for line in b.schedule_lines:
            outstanding = float(line.amount) - float(line.paid_amount)
            if outstanding <= 0.005 or line.due_date > as_of_date:
                continue
            days = (as_of_date - line.due_date).days
            if days <= 30:
                b0 += outstanding
            elif days <= 60:
                b1 += outstanding
            elif days <= 90:
                b2 += outstanding
            else:
                b3 += outstanding

        row_total = b0 + b1 + b2 + b3
        if row_total <= 0.005:
            continue

        rows.append(
            AgingRow(
                booking_id=b.id,
                booking_ref_no=b.booking_ref_no,
                allottee_name=b.allottee.name,
                project_name=b.project.project_name,
                bucket_0_30=round(b0, 2),
                bucket_31_60=round(b1, 2),
                bucket_61_90=round(b2, 2),
                bucket_90_plus=round(b3, 2),
                total_outstanding=round(row_total, 2),
            )
        )
        total_0_30 += b0
        total_31_60 += b1
        total_61_90 += b2
        total_90_plus += b3

    rows.sort(key=lambda r: -r.total_outstanding)

    return AgingReport(
        as_of_date=as_of_date,
        rows=rows,
        total_0_30=round(total_0_30, 2),
        total_31_60=round(total_31_60, 2),
        total_61_90=round(total_61_90, 2),
        total_90_plus=round(total_90_plus, 2),
        grand_total=round(total_0_30 + total_31_60 + total_61_90 + total_90_plus, 2),
    )


# Sales / Purchase


def get_sales_purchase_report(
    db: Session,
    date_from: date | None = None,
    date_to: date | None = None,
    project_id: int | None = None,
) -> SalesPurchaseReport:
    sales_query = db.query(Booking).filter(Booking.status != BookingStatus.CANCELLED)
    if project_id is not None:
        sales_query = sales_query.filter(Booking.project_id == project_id)
    if date_from is not None:
        sales_query = sales_query.filter(Booking.booking_date >= date_from)
    if date_to is not None:
        sales_query = sales_query.filter(Booking.booking_date <= date_to)
    sales = sales_query.all()

    purchase_query = db.query(GRN)
    if project_id is not None:
        purchase_query = purchase_query.filter(GRN.project_id == project_id)
    if date_from is not None:
        purchase_query = purchase_query.filter(GRN.grn_date >= date_from)
    if date_to is not None:
        purchase_query = purchase_query.filter(GRN.grn_date <= date_to)
    purchases = purchase_query.all()

    return SalesPurchaseReport(
        date_from=date_from,
        date_to=date_to,
        project_id=project_id,
        sales_count=len(sales),
        sales_total=round(sum(float(b.total_price) for b in sales), 2),
        purchase_count=len(purchases),
        purchase_total=round(sum(float(g.total_amount) for g in purchases), 2),
    )


# Stock ledger


def get_stock_ledger_report(
    db: Session,
    material_id: int,
    project_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> StockLedgerReport | None:
    material = db.query(Material).filter(Material.id == material_id).first()
    if not material:
        return None

    query = db.query(StockLedger).filter(StockLedger.material_id == material_id)
    if project_id is not None:
        query = query.filter(StockLedger.project_id == project_id)

    def _delta(row: StockLedger) -> tuple[float, float]:
        sign = 1 if row.movement_type == StockMovementType.IN else -1
        return sign * float(row.quantity), sign * float(row.amount)

    opening_qty = 0.0
    opening_value = 0.0
    if date_from is not None:
        for row in query.filter(StockLedger.movement_date < date_from).order_by(StockLedger.id).all():
            dq, dv = _delta(row)
            opening_qty += dq
            opening_value += dv

    filtered = query
    if date_from is not None:
        filtered = filtered.filter(StockLedger.movement_date >= date_from)
    if date_to is not None:
        filtered = filtered.filter(StockLedger.movement_date <= date_to)

    running_qty = opening_qty
    running_value = opening_value
    lines: list[StockLedgerRow] = []
    for row in filtered.order_by(StockLedger.movement_date, StockLedger.id).all():
        dq, dv = _delta(row)
        running_qty += dq
        running_value += dv
        lines.append(
            StockLedgerRow(
                movement_date=row.movement_date,
                movement_type=row.movement_type.value,
                ref_type=row.ref_type.value,
                ref_id=row.ref_id,
                quantity=float(row.quantity),
                rate=float(row.rate),
                amount=float(row.amount),
                balance_qty=round(running_qty, 2),
                balance_value=round(running_value, 2),
            )
        )

    return StockLedgerReport(
        material_id=material.id,
        material_code=material.material_code,
        material_name=material.name,
        unit_of_measure=material.unit_of_measure,
        project_id=project_id,
        opening_qty=round(opening_qty, 2),
        opening_value=round(opening_value, 2),
        lines=lines,
        closing_qty=round(running_qty, 2),
        closing_value=round(running_value, 2),
    )


# Customer-wise


def get_customer_wise_report(db: Session, project_id: int | None = None) -> CustomerWiseReport:
    allottees = db.query(Allottee).order_by(Allottee.name).all()

    rows: list[CustomerWiseRow] = []
    grand_booked = 0.0
    grand_received = 0.0

    for a in allottees:
        query = (
            db.query(Booking)
            .options(joinedload(Booking.schedule_lines))
            .filter(Booking.allottee_id == a.id, Booking.status != BookingStatus.CANCELLED)
        )
        if project_id is not None:
            query = query.filter(Booking.project_id == project_id)
        bookings = query.all()
        if not bookings:
            continue

        total_booked = sum(float(b.total_price) for b in bookings)
        total_received = sum(float(l.paid_amount) for b in bookings for l in b.schedule_lines)
        balance = total_booked - total_received

        rows.append(
            CustomerWiseRow(
                allottee_id=a.id,
                allottee_code=a.allottee_code,
                name=a.name,
                bookings_count=len(bookings),
                total_booked=round(total_booked, 2),
                total_received=round(total_received, 2),
                balance=round(balance, 2),
            )
        )
        grand_booked += total_booked
        grand_received += total_received

    rows.sort(key=lambda r: -r.balance)

    return CustomerWiseReport(
        rows=rows,
        grand_total_booked=round(grand_booked, 2),
        grand_total_received=round(grand_received, 2),
        grand_total_balance=round(grand_booked - grand_received, 2),
    )


# Broker / Partner


def get_all_broker_summaries(db: Session, project_id: int | None = None) -> list[BrokerSummaryRow]:
    agents = agent_crud.list_agents(db)
    rows = []
    for a in agents:
        summary = agent_crud.get_agent_summary(db, a.id)
        bookings = [b for b in summary.bookings if project_id is None or b.project_id == project_id]
        if project_id is not None and not bookings:
            continue  # this broker brought nobody into the selected project
        rows.append(
            BrokerSummaryRow(
                agent_id=a.id,
                agent_code=a.agent_code,
                name=a.name,
                total_eligible=round(sum(b.commission_eligible_amount for b in bookings), 2),
                total_paid=round(sum(b.commission_paid for b in bookings), 2),
                total_balance=round(sum(b.commission_balance for b in bookings), 2),
            )
        )
    rows.sort(key=lambda r: -r.total_balance)
    return rows


def get_all_partner_summaries(db: Session, project_id: int | None = None) -> list[PartnerSummaryRow]:
    partners = partner_crud.list_partners(db)
    rows = []
    for p in partners:
        summary = partner_crud.get_partner_summary(db, p.id)
        projects = [r for r in summary.projects if project_id is None or r.project_id == project_id]
        if project_id is not None and not projects:
            continue  # no share in the selected project

        def total(field: str) -> float:
            return round(sum(getattr(r, field) for r in projects), 2)

        rows.append(
            PartnerSummaryRow(
                partner_id=p.id,
                partner_code=p.partner_code,
                name=p.name,
                total_share_amount=total("partner_share_amount"),
                total_drawn=total("drawn_amount"),
                total_balance=total("balance"),
                total_contributed=total("contributed_amount"),
                total_distributable_share=total("partner_distributable_share"),
                total_partner_expense=total("partner_expense_amount"),
                total_current_account_balance=total("current_account_balance"),
            )
        )
    rows.sort(key=lambda r: -r.total_balance)
    return rows


def get_rental_income_report(db: Session, project_id: int | None = None) -> list[RentalIncomeRow]:
    agreements = (
        db.query(RentAgreement)
        .options(
            joinedload(RentAgreement.unit),
            joinedload(RentAgreement.land_property),
            joinedload(RentAgreement.tenant),
            joinedload(RentAgreement.schedule_lines),
        )
        .all()
    )
    if project_id is not None:
        # Only that project's shops/units — standalone land/plots belong to no project.
        agreements = [a for a in agreements if a.unit is not None and a.unit.project_id == project_id]

    buckets: dict[tuple[str, int], dict] = {}
    for a in agreements:
        if a.unit_id:
            key = ("Unit", a.unit_id)
            label = a.unit.unit_number
        else:
            key = ("Land", a.land_property_id)
            label = f"{a.land_property.property_ref_no} · {a.land_property.area_location}"

        bucket = buckets.setdefault(
            key,
            {
                "property_type": key[0],
                "property_label": label,
                "current_tenant": None,
                "agreement_count": 0,
                "total_scheduled": 0.0,
                "total_received": 0.0,
            },
        )
        bucket["agreement_count"] += 1
        bucket["total_scheduled"] += sum(float(line.amount) for line in a.schedule_lines)
        bucket["total_received"] += sum(float(line.paid_amount) for line in a.schedule_lines)
        if a.status == RentAgreementStatus.ACTIVE:
            bucket["current_tenant"] = a.tenant.name

    rows = [
        RentalIncomeRow(
            property_type=v["property_type"],
            property_label=v["property_label"],
            current_tenant=v["current_tenant"],
            agreement_count=v["agreement_count"],
            total_scheduled=v["total_scheduled"],
            total_received=v["total_received"],
            outstanding=v["total_scheduled"] - v["total_received"],
        )
        for v in buckets.values()
    ]
    rows.sort(key=lambda r: -r.total_received)
    return rows


# Land & Plots


def get_land_property_report(db: Session) -> list[LandPropertyReportRow]:
    """Per property: what was paid to the seller, received from a buyer,
    spent on it (office expenses tagged to it) and earned in rent."""
    properties = (
        db.query(LandProperty)
        .options(joinedload(LandProperty.payments))
        .order_by(LandProperty.id.desc())
        .all()
    )
    expenses_by_property: dict[int, float] = {}
    for expense in db.query(OfficeExpense).filter(OfficeExpense.land_property_id.is_not(None)).all():
        expenses_by_property[expense.land_property_id] = (
            expenses_by_property.get(expense.land_property_id, 0.0) + float(expense.amount)
        )
    rent_by_property: dict[int, float] = {}
    rent_receipts = (
        db.query(RentReceipt)
        .join(RentAgreement, RentReceipt.agreement_id == RentAgreement.id)
        .filter(RentAgreement.land_property_id.is_not(None))
        .options(joinedload(RentReceipt.agreement))
        .all()
    )
    for receipt in rent_receipts:
        pid = receipt.agreement.land_property_id
        rent_by_property[pid] = rent_by_property.get(pid, 0.0) + float(receipt.amount)

    rows: list[LandPropertyReportRow] = []
    for p in properties:
        paid_to_seller = sum(
            float(x.amount) for x in p.payments if x.direction == LandPropertyPaymentDirection.TO_SELLER
        )
        received_from_buyer = sum(
            float(x.amount) for x in p.payments if x.direction == LandPropertyPaymentDirection.FROM_BUYER
        )
        purchase_price = float(p.purchase_rate or 0)
        sale_price = float(p.sale_rate or 0) if p.status == LandPropertyStatus.SOLD else 0.0
        expenses = expenses_by_property.get(p.id, 0.0)
        rent = rent_by_property.get(p.id, 0.0)
        rows.append(
            LandPropertyReportRow(
                property_id=p.id,
                property_ref_no=p.property_ref_no,
                property_type=p.property_type.value,
                area_location=p.area_location,
                size_label=f"{float(p.size_number or 0):g} {p.size_unit.value}",
                status=p.status.value,
                owner_vendor=p.owner_vendor,
                purchase_price=round(purchase_price, 2),
                paid_to_seller=round(paid_to_seller, 2),
                owed_to_seller=round(max(purchase_price - paid_to_seller, 0), 2),
                sale_price=round(sale_price, 2),
                received_from_buyer=round(received_from_buyer, 2),
                receivable_from_buyer=round(max(sale_price - received_from_buyer, 0), 2),
                expenses=round(expenses, 2),
                rent_received=round(rent, 2),
                net_cash=round(received_from_buyer + rent - paid_to_seller - expenses, 2),
            )
        )
    return rows


# Material / Employee


def get_material_summary_report(db: Session, project_id: int | None = None) -> list[MaterialSummaryRow]:
    materials = db.query(Material).order_by(Material.name).all()
    balances = inventory_crud.get_stock_balances(db, project_id=project_id)

    balance_by_material: dict[int, dict[str, float]] = {}
    for b in balances:
        agg = balance_by_material.setdefault(b["material_id"], {"qty": 0.0, "value": 0.0})
        agg["qty"] += b["balance_qty"]
        agg["value"] += b["balance_value"]

    rows = []
    for mat in materials:
        purchased_query = db.query(GRNLine).filter(GRNLine.material_id == mat.id)
        issued_query = db.query(MaterialIssueLine).filter(MaterialIssueLine.material_id == mat.id)
        if project_id is not None:
            purchased_query = purchased_query.join(GRN).filter(GRN.project_id == project_id)
            issued_query = issued_query.join(MaterialIssue).filter(MaterialIssue.project_id == project_id)
        purchased_lines = purchased_query.all()
        issued_lines = issued_query.all()
        bal = balance_by_material.get(mat.id, {"qty": 0.0, "value": 0.0})
        if project_id is not None and not (purchased_lines or issued_lines or bal["qty"]):
            continue  # material never touched the selected project

        rows.append(
            MaterialSummaryRow(
                material_id=mat.id,
                material_code=mat.material_code,
                name=mat.name,
                unit_of_measure=mat.unit_of_measure,
                total_purchased_qty=round(sum(float(l.quantity) for l in purchased_lines), 2),
                total_purchased_value=round(sum(float(l.amount) for l in purchased_lines), 2),
                total_issued_qty=round(sum(float(l.quantity) for l in issued_lines), 2),
                total_issued_value=round(sum(float(l.amount) for l in issued_lines), 2),
                current_balance_qty=round(bal["qty"], 2),
                current_balance_value=round(bal["value"], 2),
            )
        )
    return rows


def get_employee_summary_report(db: Session) -> list[EmployeeSummaryRow]:
    employees = expense_crud.list_employees(db)
    rows = []
    for emp in employees:
        payments = db.query(WagePayment).filter(WagePayment.employee_id == emp.id).all()
        last_date = max((p.payment_date for p in payments), default=None)
        rows.append(
            EmployeeSummaryRow(
                employee_id=emp.id,
                employee_code=emp.employee_code,
                name=emp.name,
                designation=emp.designation,
                wage_type=emp.wage_type.value,
                total_paid=round(sum(float(p.net_paid) for p in payments), 2),
                payment_count=len(payments),
                last_payment_date=last_date,
            )
        )
    rows.sort(key=lambda r: -r.total_paid)
    return rows
