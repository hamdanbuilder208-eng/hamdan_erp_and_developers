from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.communication import CommunicationLog
from app.models.inventory import GRN, GRNLine, StockLedger
from app.models.voucher import Voucher, VoucherLine
from app.schemas.data_integrity import IntegrityCheckResult

TOLERANCE = 0.01


def _check_unbalanced_vouchers(db: Session) -> IntegrityCheckResult:
    rows = (
        db.query(
            Voucher.id,
            Voucher.voucher_no,
            func.sum(VoucherLine.debit).label("total_debit"),
            func.sum(VoucherLine.credit).label("total_credit"),
        )
        .join(VoucherLine, VoucherLine.voucher_id == Voucher.id)
        .group_by(Voucher.id, Voucher.voucher_no)
        .all()
    )
    issues = [
        f"{voucher_no}: debit {float(total_debit):,.2f} != credit {float(total_credit):,.2f}"
        for _id, voucher_no, total_debit, total_credit in rows
        if abs(float(total_debit) - float(total_credit)) > TOLERANCE
    ]
    return IntegrityCheckResult(
        name="Unbalanced vouchers", ok=not issues, issue_count=len(issues), details=issues
    )


def _check_booking_price_mismatch(db: Session) -> IntegrityCheckResult:
    bookings = db.query(Booking).all()
    issues = []
    for b in bookings:
        schedule_total = sum(float(l.amount) for l in b.schedule_lines)
        if abs(schedule_total - float(b.total_price)) > TOLERANCE:
            issues.append(
                f"{b.booking_ref_no}: schedule total {schedule_total:,.2f} != "
                f"total_price {float(b.total_price):,.2f}"
            )
    return IntegrityCheckResult(
        name="Booking price mismatch", ok=not issues, issue_count=len(issues), details=issues
    )


def _check_negative_stock(db: Session) -> IntegrityCheckResult:
    latest_subq = (
        db.query(
            StockLedger.material_id,
            StockLedger.project_id,
            func.max(StockLedger.id).label("latest_id"),
        )
        .group_by(StockLedger.material_id, StockLedger.project_id)
        .subquery()
    )
    negative_rows = (
        db.query(StockLedger)
        .join(latest_subq, StockLedger.id == latest_subq.c.latest_id)
        .filter(StockLedger.balance_qty < 0)
        .all()
    )
    issues = [
        f"material #{row.material_id} / project #{row.project_id}: balance {float(row.balance_qty):,.2f}"
        for row in negative_rows
    ]
    return IntegrityCheckResult(
        name="Negative stock balances", ok=not issues, issue_count=len(issues), details=issues
    )


def _check_grn_total_mismatch(db: Session) -> IntegrityCheckResult:
    rows = (
        db.query(GRN.id, GRN.grn_no, GRN.total_amount, func.sum(GRNLine.amount).label("line_total"))
        .join(GRNLine, GRNLine.grn_id == GRN.id)
        .group_by(GRN.id, GRN.grn_no, GRN.total_amount)
        .all()
    )
    issues = [
        f"{grn_no}: total_amount {float(total_amount):,.2f} != line sum {float(line_total):,.2f}"
        for _id, grn_no, total_amount, line_total in rows
        if abs(float(total_amount) - float(line_total)) > TOLERANCE
    ]
    return IntegrityCheckResult(
        name="GRN total mismatch", ok=not issues, issue_count=len(issues), details=issues
    )


def _check_communication_logs_missing_user(db: Session) -> IntegrityCheckResult:
    rows = (
        db.query(CommunicationLog)
        .filter(CommunicationLog.sent_by_user_id.is_(None))
        .order_by(CommunicationLog.id.desc())
        .all()
    )
    issues = [f"log #{row.id} ({row.channel.value} to {row.recipient_phone})" for row in rows]
    return IntegrityCheckResult(
        name="Communication logs missing a linked user",
        ok=not issues,
        issue_count=len(issues),
        details=issues,
    )


def run_checks(db: Session) -> list[IntegrityCheckResult]:
    return [
        _check_unbalanced_vouchers(db),
        _check_booking_price_mismatch(db),
        _check_negative_stock(db),
        _check_grn_total_mismatch(db),
        _check_communication_logs_missing_user(db),
    ]
