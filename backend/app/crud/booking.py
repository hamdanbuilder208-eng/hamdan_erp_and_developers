from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account
from app.models.booking import (
    Booking,
    BookingExtraCharge,
    BookingInstallmentPlan,
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
from app.schemas.booking import (
    BookingCreate,
    BookingTransferCreate,
    ExtraChargeCreate,
    InstallmentPlanCreate,
)

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
        joinedload(Booking.installment_plans),
        joinedload(Booking.extra_charges),
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


def _add_extra_charge(db: Session, db_booking: Booking, charge_in: ExtraChargeCreate) -> BookingExtraCharge:
    """Posts one extra-charge line: its own one-off schedule line, its own
    revenue-recognition voucher (kept separate from the booking's own so it
    can be added and reversed independently), and bumps total_price. Used
    both at booking creation and for charges added later (see add_extra_charge)."""
    schedule_line = PaymentScheduleLine(
        booking_id=db_booking.id,
        installment_no=0,
        label=f"Extra Charges — {charge_in.reason.value}",
        due_date=charge_in.charge_date,
        amount=charge_in.amount,
    )
    db.add(schedule_line)
    db.flush()

    voucher = None
    receivable_account = db.query(Account).filter(Account.code == RECEIVABLE_ACCOUNT_CODE).first()
    revenue_account = db.query(Account).filter(Account.code == UNIT_SALES_ACCOUNT_CODE).first()
    if receivable_account and revenue_account:
        voucher = Voucher(
            voucher_no=_next_journal_voucher_no(db),
            voucher_type=VoucherType.JOURNAL,
            voucher_date=charge_in.charge_date,
            project_id=db_booking.project_id,
            narration=f"Extra charge ({charge_in.reason.value}) on booking {db_booking.booking_ref_no}",
        )
        db.add(voucher)
        db.flush()
        db.add(
            VoucherLine(
                voucher_id=voucher.id,
                account_id=receivable_account.id,
                debit=charge_in.amount,
                credit=0,
                narration=f"Extra charge ({charge_in.reason.value}) — {db_booking.booking_ref_no}",
            )
        )
        db.add(
            VoucherLine(
                voucher_id=voucher.id,
                account_id=revenue_account.id,
                debit=0,
                credit=charge_in.amount,
                narration=f"Extra charge ({charge_in.reason.value}) — {db_booking.booking_ref_no}",
            )
        )

    db_charge = BookingExtraCharge(
        booking_id=db_booking.id,
        schedule_line_id=schedule_line.id,
        voucher_id=voucher.id if voucher else None,
        reason=charge_in.reason,
        amount=charge_in.amount,
        charge_date=charge_in.charge_date,
        narration=charge_in.narration,
    )
    db.add(db_charge)
    db_booking.total_price = float(db_booking.total_price) + charge_in.amount
    db.flush()
    return db_charge


def get_extra_charge(db: Session, charge_id: int) -> BookingExtraCharge | None:
    return db.query(BookingExtraCharge).filter(BookingExtraCharge.id == charge_id).first()


def add_extra_charge(db: Session, db_booking: Booking, charge_in: ExtraChargeCreate) -> Booking:
    if db_booking.status == BookingStatus.CANCELLED:
        raise ValueError("Cannot add a charge to a cancelled booking")
    _add_extra_charge(db, db_booking, charge_in)
    db.commit()
    return get_booking(db, db_booking.id)


def delete_extra_charge(db: Session, db_charge: BookingExtraCharge) -> None:
    schedule_line = (
        db.query(PaymentScheduleLine).filter(PaymentScheduleLine.id == db_charge.schedule_line_id).first()
    )
    if schedule_line and float(schedule_line.paid_amount) > 0:
        raise ValueError(
            "This charge has already been partly or fully paid and cannot be removed — "
            "reverse the receipt against it first."
        )

    booking = db.query(Booking).filter(Booking.id == db_charge.booking_id).first()
    if booking:
        booking.total_price = float(booking.total_price) - float(db_charge.amount)

    voucher_id = db_charge.voucher_id
    db.delete(db_charge)
    db.flush()
    if schedule_line:
        db.delete(schedule_line)
    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)
    db.commit()


def _add_installment_plan_lines(
    db: Session, booking_id: int, plan_in: InstallmentPlanCreate, installment_seq: int
) -> int:
    """Creates one BookingInstallmentPlan + its PaymentScheduleLines, evenly
    splitting total_amount across no_of_installments (remainder on the last
    one). installment_seq is the running installment number across every plan
    on this booking so far — returns it advanced past the lines just added."""
    db_plan = BookingInstallmentPlan(
        booking_id=booking_id,
        label=plan_in.label,
        frequency=plan_in.frequency,
        no_of_installments=plan_in.no_of_installments,
        total_amount=plan_in.total_amount,
        start_date=plan_in.start_date,
    )
    db.add(db_plan)
    db.flush()

    month_step = _FREQUENCY_MONTHS[plan_in.frequency]
    base_amount = round(plan_in.total_amount / plan_in.no_of_installments, 2)
    allocated = 0.0
    for i in range(1, plan_in.no_of_installments + 1):
        amount = base_amount
        if i == plan_in.no_of_installments:
            amount = round(plan_in.total_amount - allocated, 2)
        allocated += amount
        installment_seq += 1
        due_date = plan_in.start_date + relativedelta(months=month_step * (i - 1))
        db.add(
            PaymentScheduleLine(
                booking_id=booking_id,
                installment_plan_id=db_plan.id,
                installment_no=installment_seq,
                label=f"{plan_in.label} {i}",
                due_date=due_date,
                amount=amount,
            )
        )
    return installment_seq


def add_installment_plan(db: Session, booking: Booking, plan_in: InstallmentPlanCreate) -> Booking:
    """Attaches a new installment plan to a booking that already exists —
    e.g. one created with no plan yet (down payment only), now getting one
    set up from the Receipts screen once the client decides how to pay the
    rest. Rejects a plan that would schedule more than what's still
    unaccounted for across the booking's existing schedule lines."""
    already_scheduled = sum(float(line.amount) for line in booking.schedule_lines)
    remaining = float(booking.total_price) - already_scheduled
    if round(plan_in.total_amount, 2) > round(remaining, 2) + 0.01:
        raise ValueError(
            f"Plan amount PKR {plan_in.total_amount:,.2f} exceeds the PKR {remaining:,.2f} "
            "still unscheduled on this booking."
        )

    installment_seq = max((line.installment_no for line in booking.schedule_lines), default=0)
    _add_installment_plan_lines(db, booking.id, plan_in, installment_seq)
    db.commit()
    return get_booking(db, booking.id)


def create_booking(db: Session, booking_in: BookingCreate) -> Booking:
    unit = db.query(Unit).filter(Unit.id == booking_in.unit_id).first()
    if not unit:
        raise ValueError("Unit not found")
    if unit.status != UnitStatus.AVAILABLE:
        raise ValueError(f"Unit is not available (current status: {unit.status.value})")

    # Extra charges are posted separately below (each its own line + voucher)
    # and layered on top, so they don't factor into the installment-plan math.
    base_price = float(unit.total_price) - booking_in.discount

    db_booking = Booking(
        booking_ref_no=_next_booking_ref_no(db),
        booking_date=booking_in.booking_date,
        project_id=booking_in.project_id,
        unit_id=booking_in.unit_id,
        allottee_id=booking_in.allottee_id,
        status=BookingStatus.BOOKED,
        status_date=booking_in.status_date,
        discount=booking_in.discount,
        total_price=base_price,
        remarks=booking_in.remarks,
        booking_agent_id=booking_in.booking_agent_id,
        agent_commission_percent=booking_in.agent_commission_percent,
        down_payment_amount=booking_in.down_payment_amount,
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

    remaining = base_price - booking_in.down_payment_amount
    plans_total = sum(plan.total_amount for plan in booking_in.installment_plans)
    if booking_in.installment_plans and round(plans_total, 2) != round(remaining, 2):
        raise ValueError(
            f"Installment plans total PKR {plans_total:,.2f} but PKR {remaining:,.2f} remains "
            "after the down payment — they must add up to the same amount."
        )

    installment_seq = 0
    for plan_in in booking_in.installment_plans:
        installment_seq = _add_installment_plan_lines(db, db_booking.id, plan_in, installment_seq)

    unit.status = UnitStatus.BOOKED

    receivable_account = db.query(Account).filter(Account.code == RECEIVABLE_ACCOUNT_CODE).first()
    revenue_account = db.query(Account).filter(Account.code == UNIT_SALES_ACCOUNT_CODE).first()
    if receivable_account and revenue_account and base_price > 0:
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
                debit=base_price,
                credit=0,
                narration=f"Receivable for {db_booking.booking_ref_no}",
            )
        )
        db.add(
            VoucherLine(
                voucher_id=voucher.id,
                account_id=revenue_account.id,
                debit=0,
                credit=base_price,
                narration=f"Sale of {unit.unit_number}",
            )
        )
        db_booking.revenue_voucher_id = voucher.id

    for charge_in in booking_in.extra_charges:
        _add_extra_charge(db, db_booking, charge_in)

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
        if not has_receipts:
            voucher_ids = []
            if db_booking.revenue_voucher_id:
                voucher_ids.append(db_booking.revenue_voucher_id)
                db_booking.revenue_voucher_id = None
            for charge in db_booking.extra_charges:
                if charge.voucher_id:
                    voucher_ids.append(charge.voucher_id)
                    charge.voucher_id = None
            db.flush()
            for voucher_id in voucher_ids:
                voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
                if voucher:
                    db.delete(voucher)
        else:
            # Money was already collected — track what's owed back as a
            # Pending refund instead of letting it silently disappear.
            # Deferred import: crud/refund.py imports update_booking_status
            # from this module, so this stays a function-local import to
            # avoid a circular import at module load time.
            total_paid = sum(float(line.paid_amount) for line in db_booking.schedule_lines)
            if total_paid > 0:
                from app.crud.refund import create_pending_refund

                create_pending_refund(db, db_booking, total_paid, status_date)
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

    voucher_ids = []
    if db_booking.revenue_voucher_id:
        voucher_ids.append(db_booking.revenue_voucher_id)
        db_booking.revenue_voucher_id = None
    for charge in db_booking.extra_charges:
        if charge.voucher_id:
            voucher_ids.append(charge.voucher_id)
    db.flush()

    # extra_charges rows cascade-delete along with the booking, so once it's
    # gone nothing references their vouchers any more and those are safe to
    # delete too.
    db.delete(db_booking)
    db.flush()
    for voucher_id in voucher_ids:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)
    db.commit()
