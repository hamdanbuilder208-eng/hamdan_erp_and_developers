from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.crud.booking import update_booking_status
from app.models.booking import Booking, BookingStatus
from app.models.refund import Refund, RefundPayment, RefundStatus, RefundType
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.refund import RefundCreate, RefundDeductionUpdate, RefundPaymentCreate


def _next_refund_no(db: Session) -> str:
    return next_sequence_number(db, Refund.refund_no, "REF-", 5)


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "PV-", 5)


def _load_query(db: Session):
    return db.query(Refund).options(
        joinedload(Refund.booking),
        joinedload(Refund.payments).joinedload(RefundPayment.account),
        joinedload(Refund.payments).joinedload(RefundPayment.cash_account),
    )


def list_refunds(
    db: Session, refund_type: str | None = None, booking_id: int | None = None
) -> list[Refund]:
    query = _load_query(db)
    if refund_type is not None:
        query = query.filter(Refund.refund_type == refund_type)
    if booking_id is not None:
        query = query.filter(Refund.booking_id == booking_id)
    return query.order_by(Refund.id.desc()).all()


def get_refund(db: Session, refund_id: int) -> Refund | None:
    return _load_query(db).filter(Refund.id == refund_id).first()


def get_payment(db: Session, payment_id: int) -> RefundPayment | None:
    return db.query(RefundPayment).filter(RefundPayment.id == payment_id).first()


def _paid_so_far(db: Session, refund_id: int) -> float:
    # Queried fresh rather than read off db_refund.payments, which can be a
    # stale in-memory collection right after a sibling row was just added.
    total = (
        db.query(func.coalesce(func.sum(RefundPayment.amount), 0))
        .filter(RefundPayment.refund_id == refund_id)
        .scalar()
    )
    return float(total)


def _refresh_status(db: Session, db_refund: Refund) -> None:
    paid = _paid_so_far(db, db_refund.id)
    if paid <= 0:
        db_refund.status = RefundStatus.PENDING
    elif paid < float(db_refund.net_amount):
        db_refund.status = RefundStatus.PARTIALLY_PAID
    else:
        db_refund.status = RefundStatus.PAID


def create_refund(db: Session, refund_in: RefundCreate) -> Refund:
    net_amount = refund_in.gross_amount - refund_in.deduction_amount

    booking = None
    if refund_in.refund_type == RefundType.CUSTOMER:
        booking = db.query(Booking).filter(Booking.id == refund_in.booking_id).first()
        if not booking:
            raise ValueError("Booking not found")
        if booking.status == BookingStatus.CANCELLED:
            raise ValueError("This booking is already cancelled")

    db_refund = Refund(
        refund_no=_next_refund_no(db),
        refund_date=refund_in.refund_date,
        refund_type=refund_in.refund_type,
        booking_id=refund_in.booking_id,
        party_name=refund_in.party_name,
        gross_amount=refund_in.gross_amount,
        deduction_percent=refund_in.deduction_percent,
        deduction_amount=refund_in.deduction_amount,
        net_amount=net_amount,
        status=RefundStatus.PENDING,
        narration=refund_in.narration,
    )
    db.add(db_refund)
    db.commit()

    if booking:
        update_booking_status(db, booking, BookingStatus.CANCELLED, refund_in.refund_date)

    return get_refund(db, db_refund.id)


def create_pending_refund(
    db: Session, booking: Booking, gross_amount: float, refund_date: date
) -> Refund:
    """Auto-tracks a refund owed when a booking with payments already made
    gets cancelled. Idempotent: re-cancelling a booking that was reactivated
    and cancelled again reuses the same row instead of duplicating it."""
    existing = (
        db.query(Refund)
        .filter(Refund.booking_id == booking.id, Refund.refund_type == RefundType.CUSTOMER)
        .first()
    )
    if existing:
        return existing

    db_refund = Refund(
        refund_no=_next_refund_no(db),
        refund_date=refund_date,
        refund_type=RefundType.CUSTOMER,
        booking_id=booking.id,
        party_name=booking.allottee.name if booking.allottee else None,
        gross_amount=gross_amount,
        deduction_amount=0,
        net_amount=gross_amount,
        status=RefundStatus.PENDING,
        narration=(
            f"Auto-created — booking {booking.booking_ref_no} cancelled with "
            f"PKR {gross_amount:,.2f} already paid"
        ),
    )
    db.add(db_refund)
    db.flush()
    return db_refund


def update_deduction(db: Session, db_refund: Refund, deduction_in: RefundDeductionUpdate) -> Refund:
    if deduction_in.deduction_amount > float(db_refund.gross_amount):
        raise ValueError("Deduction cannot exceed the gross amount")
    new_net = float(db_refund.gross_amount) - deduction_in.deduction_amount
    paid = _paid_so_far(db, db_refund.id)
    if new_net < paid:
        raise ValueError(
            f"Can't set net amount below PKR {paid:,.2f} already paid out — delete a payment first"
        )

    db_refund.deduction_percent = deduction_in.deduction_percent
    db_refund.deduction_amount = deduction_in.deduction_amount
    db_refund.net_amount = new_net
    _refresh_status(db, db_refund)
    db.commit()
    return get_refund(db, db_refund.id)


def add_payment(db: Session, db_refund: Refund, payment_in: RefundPaymentCreate) -> Refund:
    if db_refund.status == RefundStatus.PAID:
        raise ValueError("This refund has already been paid in full")
    remaining = float(db_refund.net_amount) - _paid_so_far(db, db_refund.id)
    if payment_in.amount > remaining + 0.01:
        raise ValueError(f"Only PKR {remaining:,.2f} remains on this refund")

    db_payment = RefundPayment(
        refund_id=db_refund.id,
        payment_date=payment_in.payment_date,
        amount=payment_in.amount,
        account_id=payment_in.account_id,
        cash_account_id=payment_in.cash_account_id,
        narration=payment_in.narration,
    )
    db.add(db_payment)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=payment_in.payment_date,
        project_id=db_refund.booking.project_id if db_refund.booking else None,
        narration=f"{db_refund.refund_type.value} refund {db_refund.refund_no} — installment",
    )
    db.add(voucher)
    db.flush()

    amount = float(payment_in.amount)
    if db_refund.refund_type == RefundType.VENDOR:
        # Money received back from vendor: Dr Cash/Bank, Cr Vendor/Payable account
        db.add(
            VoucherLine(
                voucher_id=voucher.id, account_id=payment_in.cash_account_id,
                debit=amount, credit=0, narration="Vendor refund received",
            )
        )
        db.add(
            VoucherLine(
                voucher_id=voucher.id, account_id=payment_in.account_id,
                debit=0, credit=amount, narration="Vendor refund received",
            )
        )
    else:
        # Customer refund (reduces revenue) or Employee reimbursement (an expense):
        # Dr account_id, Cr Cash/Bank
        db.add(
            VoucherLine(
                voucher_id=voucher.id, account_id=payment_in.account_id,
                debit=amount, credit=0, narration=f"{db_refund.refund_type.value} refund",
            )
        )
        db.add(
            VoucherLine(
                voucher_id=voucher.id, account_id=payment_in.cash_account_id,
                debit=0, credit=amount, narration=f"{db_refund.refund_type.value} refund paid",
            )
        )

    db_payment.voucher_id = voucher.id
    db.flush()

    _refresh_status(db, db_refund)
    db.commit()
    return get_refund(db, db_refund.id)


def delete_payment(db: Session, db_payment: RefundPayment) -> Refund | None:
    db_refund = db.query(Refund).filter(Refund.id == db_payment.refund_id).first()
    voucher_id = db_payment.voucher_id

    db.delete(db_payment)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)
    db.flush()

    if db_refund:
        _refresh_status(db, db_refund)
    db.commit()
    return get_refund(db, db_refund.id) if db_refund else None


def delete_refund(db: Session, db_refund: Refund) -> None:
    voucher_ids = [p.voucher_id for p in db_refund.payments if p.voucher_id]

    # payments cascade-delete with the refund, so their vouchers are free to
    # remove once it's gone.
    db.delete(db_refund)
    db.flush()
    for voucher_id in voucher_ids:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)
    db.commit()
