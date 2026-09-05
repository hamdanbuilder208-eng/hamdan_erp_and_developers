from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.crud import booking_agent as agent_crud
from app.crud import expense as expense_crud
from app.crud import inventory as inventory_crud
from app.crud import partner as partner_crud
from app.models.account import Account, AccountNature
from app.models.allottee import Allottee
from app.models.booking import Booking, BookingStatus
from app.models.expense import WagePayment
from app.models.inventory import GRN, GRNLine, Material, MaterialIssueLine, StockLedger, StockMovementType
from app.models.project import Project
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
    MaterialSummaryRow,
    PartnerSummaryRow,
    ProfitLossLine,
    ProfitLossReport,
    SalesPurchaseReport,
    StockLedgerReport,
    StockLedgerRow,
    TrialBalanceReport,
    TrialBalanceRow,
)


def _account_balance(db: Session, account: Account) -> float:
    lines = db.query(VoucherLine).filter(VoucherLine.account_id == account.id).all()
    posted_debit = sum(float(l.debit) for l in lines)
    posted_credit = sum(float(l.credit) for l in lines)
    opening = float(account.opening_debit) - float(account.opening_credit)
    return opening + posted_debit - posted_credit


def get_trial_balance(db: Session) -> TrialBalanceReport:
    accounts = db.query(Account).filter(Account.is_control == False).order_by(Account.code).all()  # noqa: E712
    rows: list[TrialBalanceRow] = []
    total_debit = 0.0
    total_credit = 0.0
    for acc in accounts:
        balance = _account_balance(db, acc)
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
):
    query = (
        db.query(VoucherLine)
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .options(joinedload(VoucherLine.account))
    )
    if project_id is not None:
        query = query.filter(Voucher.project_id == project_id)
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
) -> ProfitLossReport:
    lines = _voucher_lines_query(db, project_id, date_from, date_to)

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

    project_name = None
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


def get_balance_sheet(db: Session) -> BalanceSheetReport:
    accounts = db.query(Account).filter(Account.is_control == False).order_by(Account.code).all()  # noqa: E712

    assets: list[BalanceSheetLine] = []
    liabilities: list[BalanceSheetLine] = []
    capital: list[BalanceSheetLine] = []

    for acc in accounts:
        balance = _account_balance(db, acc)
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

    pl = get_profit_loss(db)
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
) -> GeneralLedgerReport | None:
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return None

    opening_balance = float(account.opening_debit) - float(account.opening_credit)

    query = (
        db.query(VoucherLine)
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .options(joinedload(VoucherLine.voucher))
        .filter(VoucherLine.account_id == account_id)
    )

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


def get_aging_report(db: Session, as_of_date: date | None = None) -> AgingReport:
    if as_of_date is None:
        as_of_date = date.today()

    bookings = (
        db.query(Booking)
        .options(
            joinedload(Booking.allottee),
            joinedload(Booking.project),
            joinedload(Booking.schedule_lines),
        )
        .filter(Booking.status != BookingStatus.CANCELLED)
        .all()
    )

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


def get_customer_wise_report(db: Session) -> CustomerWiseReport:
    allottees = db.query(Allottee).order_by(Allottee.name).all()

    rows: list[CustomerWiseRow] = []
    grand_booked = 0.0
    grand_received = 0.0

    for a in allottees:
        bookings = (
            db.query(Booking)
            .options(joinedload(Booking.schedule_lines))
            .filter(Booking.allottee_id == a.id, Booking.status != BookingStatus.CANCELLED)
            .all()
        )
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


def get_all_broker_summaries(db: Session) -> list[BrokerSummaryRow]:
    agents = agent_crud.list_agents(db)
    rows = []
    for a in agents:
        summary = agent_crud.get_agent_summary(db, a.id)
        rows.append(
            BrokerSummaryRow(
                agent_id=a.id,
                agent_code=a.agent_code,
                name=a.name,
                total_eligible=summary.total_eligible,
                total_paid=summary.total_paid,
                total_balance=summary.total_balance,
            )
        )
    rows.sort(key=lambda r: -r.total_balance)
    return rows


def get_all_partner_summaries(db: Session) -> list[PartnerSummaryRow]:
    partners = partner_crud.list_partners(db)
    rows = []
    for p in partners:
        summary = partner_crud.get_partner_summary(db, p.id)
        rows.append(
            PartnerSummaryRow(
                partner_id=p.id,
                partner_code=p.partner_code,
                name=p.name,
                total_share_amount=summary.total_share_amount,
                total_drawn=summary.total_drawn,
                total_balance=summary.total_balance,
                total_contributed=summary.total_contributed,
                total_distributable_share=summary.total_distributable_share,
                total_partner_expense=summary.total_partner_expense,
                total_current_account_balance=summary.total_current_account_balance,
            )
        )
    rows.sort(key=lambda r: -r.total_balance)
    return rows


# Material / Employee


def get_material_summary_report(db: Session) -> list[MaterialSummaryRow]:
    materials = db.query(Material).order_by(Material.name).all()
    balances = inventory_crud.get_stock_balances(db)

    balance_by_material: dict[int, dict[str, float]] = {}
    for b in balances:
        agg = balance_by_material.setdefault(b["material_id"], {"qty": 0.0, "value": 0.0})
        agg["qty"] += b["balance_qty"]
        agg["value"] += b["balance_value"]

    rows = []
    for mat in materials:
        purchased_lines = db.query(GRNLine).filter(GRNLine.material_id == mat.id).all()
        issued_lines = db.query(MaterialIssueLine).filter(MaterialIssueLine.material_id == mat.id).all()
        bal = balance_by_material.get(mat.id, {"qty": 0.0, "value": 0.0})

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
