from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account
from app.models.booking import (
    Booking,
    BookingStatus,
    BookingTransfer,
    PaymentScheduleLine,
    ScheduleFrequency,
)
from app.models.commission_payout import CommissionPayout
from app.models.receipt import Receipt
from app.models.refund import Refund
from app.models.unit import Unit, UnitStatus
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.booking import BookingCreate, BookingTransferCreate

_FREQUENCY_MONTHS = {
    ScheduleFrequency.MONTHLY: 1,
    ScheduleFrequency.QUARTERLY: 3,
    ScheduleFrequency.HALF_YEARLY: 6,
    ScheduleFrequency.YEARLY: 12,
}

RECEIVABLE_ACCOUNT_CODE = "1030"
UNIT_SALES_ACCOUNT_CODE = "4010"


def _next_booking_ref_no(db: Session) -> str:
    return next_sequence_number(db, Booking.booking_ref_no, "BKG-", 5)


def _next_journal_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "JV-", 5)


def _load_query(db: Session):
    return db.query(Booking).options(
        joinedload(Booking.project),
        joinedload(Booking.unit),
        joinedload(Booking.allottee),
        joinedload(Booking.booking_agent),
        joinedload(Booking.schedule_lines),
    )


def list_bookings(
    db: Session,
    project_id: int | None = None,
    allottee_id: int | None = None,
    status: str | None = None,
) -> list[Booking]:
    query = _load_query(db)
    if project_id is not None:
        query = query.filter(Booking.project_id == project_id)
    if allottee_id is not None:
        query = query.filter(Booking.allottee_id == allottee_id)
    if status is not None:
        query = query.filter(Booking.status == status)
    return query.order_by(Booking.id.desc()).all()


def get_booking(db: Session, booking_id: int) -> Booking | None:
    return _load_query(db).filter(Booking.id == booking_id).first()


def create_booking(db: Session, booking_in: BookingCreate) -> Booking:
    unit = db.query(Unit).filter(Unit.id == booking_in.unit_id).first()
    if not unit:
        raise ValueError("Unit not found")
    if unit.status != UnitStatus.AVAILABLE:
        raise ValueError(f"Unit is not available (current status: {unit.status.value})")

    total_price = float(unit.total_price) - booking_in.discount + booking_in.extra_charges_amount

    db_booking = Booking(
        booking_ref_no=_next_booking_ref_no(db),
        booking_date=booking_in.booking_date,
        project_id=booking_in.project_id,
        unit_id=booking_in.unit_id,
        allottee_id=booking_in.allottee_id,
        status=BookingStatus.BOOKED,
        status_date=booking_in.status_date,
        discount=booking_in.discount,
        total_price=total_price,
        remarks=booking_in.remarks,
        booking_agent_id=booking_in.booking_agent_id,
        agent_commission_percent=booking_in.agent_commission_percent,
        down_payment_amount=booking_in.down_payment_amount,
        extra_charges_amount=booking_in.extra_charges_amount,
        extra_charges_reason=booking_in.extra_charges_reason,
        no_of_installments=booking_in.no_of_installments,
        frequency=booking_in.frequency,
    )
    db.add(db_booking)
    db.flush()

    if booking_in.down_payment_amount > 0:
        db.add(
            PaymentScheduleLine(
                booking_id=db_booking.id,
                installment_no=0,
                label="Down Payment",
                due_date=booking_in.booking_date,
                amount=booking_in.down_payment_amount,
            )
        )

    if booking_in.extra_charges_amount > 0:
        db.add(
            PaymentScheduleLine(
                booking_id=db_booking.id,
                installment_no=0,
                label=f"Extra Charges — {booking_in.extra_charges_reason.value}",
                due_date=booking_in.booking_date,
                amount=booking_in.extra_charges_amount,
            )
        )

    remaining = total_price - booking_in.down_payment_amount - booking_in.extra_charges_amount
    if booking_in.no_of_installments > 0 and remaining > 0:
        month_step = _FREQUENCY_MONTHS[booking_in.frequency]
        base_amount = round(remaining / booking_in.no_of_installments, 2)
        allocated = 0.0
        for i in range(1, booking_in.no_of_installments + 1):
            amount = base_amount
            if i == booking_in.no_of_installments:
                amount = round(remaining - allocated, 2)
            allocated += amount
            due_date = booking_in.booking_date + relativedelta(months=month_step * i)
            db.add(
                PaymentScheduleLine(
                    booking_id=db_booking.id,
                    installment_no=i,
                    label=f"Installment {i}",
                    due_date=due_date,
                    amount=amount,
                )
            )

    unit.status = UnitStatus.BOOKED

    receivable_account = db.query(Account).filter(Account.code == RECEIVABLE_ACCOUNT_CODE).first()
    revenue_account = db.query(Account).filter(Account.code == UNIT_SALES_ACCOUNT_CODE).first()
    if receivable_account and revenue_account and total_price > 0:
        voucher = Voucher(
            voucher_no=_next_journal_voucher_no(db),
            voucher_type=VoucherType.JOURNAL,
            voucher_date=booking_in.booking_date,
            project_id=booking_in.project_id,
            narration=f"Revenue recognized on booking {db_booking.booking_ref_no}",
        )
        db.add(voucher)
        db.flush()
        db.add(
            VoucherLine(
                voucher_id=voucher.id,
                account_id=receivable_account.id,
                debit=total_price,
                credit=0,
                narration=f"Receivable for {db_booking.booking_ref_no}",
            )
        )
        db.add(
            VoucherLine(
                voucher_id=voucher.id,
                account_id=revenue_account.id,
                debit=0,
                credit=total_price,
                narration=f"Sale of {unit.unit_number}",
            )
        )
        db_booking.revenue_voucher_id = voucher.id

    db.commit()
    return get_booking(db, db_booking.id)


def assign_agent(
    db: Session, db_booking: Booking, booking_agent_id: int | None, agent_commission_percent: float | None
) -> Booking:
    db_booking.booking_agent_id = booking_agent_id
    db_booking.agent_commission_percent = agent_commission_percent if booking_agent_id else None
    db.commit()
    return get_booking(db, db_booking.id)


def _load_transfer_query(db: Session):
    return db.query(BookingTransfer).options(
        joinedload(BookingTransfer.from_allottee),
        joinedload(BookingTransfer.to_allottee),
    )


def list_transfers(db: Session, booking_id: int) -> list[BookingTransfer]:
    return (
        _load_transfer_query(db)
        .filter(BookingTransfer.booking_id == booking_id)
        .order_by(BookingTransfer.id.desc())
        .all()
    )


def create_transfer(
    db: Session, db_booking: Booking, transfer_in: BookingTransferCreate
) -> BookingTransfer:
    if db_booking.status == BookingStatus.CANCELLED:
        raise ValueError("This booking is cancelled and cannot be transferred")
    if transfer_in.to_allottee_id == db_booking.allottee_id:
        raise ValueError("This booking is already held by that allottee")

    db_transfer = BookingTransfer(
        transfer_no=next_sequence_number(db, BookingTransfer.transfer_no, "TRF-", 5),
        transfer_date=transfer_in.transfer_date,
        booking_id=db_booking.id,
        from_allottee_id=db_booking.allottee_id,
        to_allottee_id=transfer_in.to_allottee_id,
        narration=transfer_in.narration,
    )
    db.add(db_transfer)
    db_booking.allottee_id = transfer_in.to_allottee_id
    db.commit()
    db.refresh(db_transfer)
    return db_transfer


def update_booking_status(
    db: Session, db_booking: Booking, new_status: BookingStatus, status_date: date
) -> Booking:
    unit = db.query(Unit).filter(Unit.id == db_booking.unit_id).first()

    if new_status == BookingStatus.CANCELLED and db_booking.status != BookingStatus.CANCELLED:
        if unit:
            unit.status = UnitStatus.AVAILABLE
        has_receipts = (
            db.query(Receipt).filter(Receipt.booking_id == db_booking.id).first() is not None
        )
        if not has_receipts and db_booking.revenue_voucher_id:
            voucher = db.query(Voucher).filter(Voucher.id == db_booking.revenue_voucher_id).first()
            if voucher:
                db_booking.revenue_voucher_id = None
                db.flush()
                db.delete(voucher)
    elif new_status == BookingStatus.POSSESSION_GIVEN:
        if unit:
            unit.status = UnitStatus.SOLD
    elif db_booking.status == BookingStatus.CANCELLED and new_status != BookingStatus.CANCELLED:
        if unit:
            unit.status = UnitStatus.BOOKED

    db_booking.status = new_status
    db_booking.status_date = status_date
    db.commit()
    return get_booking(db, db_booking.id)


def delete_booking(db: Session, db_booking: Booking) -> None:
    receipts = db.query(Receipt).filter(Receipt.booking_id == db_booking.id).all()
    if receipts:
        refs = ", ".join(r.receipt_no for r in receipts)
        raise ValueError(
            f"This booking has {len(receipts)} receipt(s) recorded against it that must be "
            f"deleted first (Receipts tab): {refs}"
        )
    refunds = db.query(Refund).filter(Refund.booking_id == db_booking.id).all()
    if refunds:
        refs = ", ".join(r.refund_no for r in refunds)
        raise ValueError(
            f"This booking has {len(refunds)} refund(s) recorded against it that must be "
            f"deleted first (Refunds tab): {refs}"
        )
    payouts = db.query(CommissionPayout).filter(CommissionPayout.booking_id == db_booking.id).all()
    if payouts:
        refs = ", ".join(p.payout_no for p in payouts)
        raise ValueError(
            f"This booking has {len(payouts)} commission payout(s) recorded against it that must be "
            f"deleted first (Broker Commissions tab): {refs}"
        )
    # Transfer history is just an audit trail with no delete UI of its own —
    # cascade it silently rather than making deletion impossible.
    db.query(BookingTransfer).filter(BookingTransfer.booking_id == db_booking.id).delete()

    unit = db.query(Unit).filter(Unit.id == db_booking.unit_id).first()
    if unit and db_booking.status != BookingStatus.CANCELLED:
        unit.status = UnitStatus.AVAILABLE

    voucher = None
    if db_booking.revenue_voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == db_booking.revenue_voucher_id).first()
        db_booking.revenue_voucher_id = None
        db.flush()

    db.delete(db_booking)
    if voucher:
        db.delete(voucher)
    db.commit()
