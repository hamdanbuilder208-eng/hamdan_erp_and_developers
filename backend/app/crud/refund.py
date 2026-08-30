from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.crud.booking import update_booking_status
from app.models.booking import Booking, BookingStatus
from app.models.refund import Refund, RefundType
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.refund import RefundCreate


def _next_refund_no(db: Session) -> str:
    return next_sequence_number(db, Refund.refund_no, "REF-", 5)


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "PV-", 5)


def _load_query(db: Session):
    return db.query(Refund).options(
        joinedload(Refund.account),
        joinedload(Refund.cash_account),
        joinedload(Refund.booking),
    )


def list_refunds(db: Session, refund_type: str | None = None) -> list[Refund]:
    query = _load_query(db)
    if refund_type is not None:
        query = query.filter(Refund.refund_type == refund_type)
    return query.order_by(Refund.id.desc()).all()


def get_refund(db: Session, refund_id: int) -> Refund | None:
    return _load_query(db).filter(Refund.id == refund_id).first()


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
        account_id=refund_in.account_id,
        cash_account_id=refund_in.cash_account_id,
        gross_amount=refund_in.gross_amount,
        deduction_percent=refund_in.deduction_percent,
        deduction_amount=refund_in.deduction_amount,
        net_amount=net_amount,
        narration=refund_in.narration,
    )
    db.add(db_refund)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=refund_in.refund_date,
        project_id=booking.project_id if booking else None,
        narration=f"{refund_in.refund_type.value} refund {db_refund.refund_no}",
    )
    db.add(voucher)
    db.flush()

    if refund_in.refund_type == RefundType.VENDOR:
        # Money received back from vendor: Dr Cash/Bank, Cr Vendor/Payable account
        db.add(
            VoucherLine(
                voucher_id=voucher.id, account_id=refund_in.cash_account_id,
                debit=net_amount, credit=0, narration="Vendor refund received",
            )
        )
        db.add(
            VoucherLine(
                voucher_id=voucher.id, account_id=refund_in.account_id,
                debit=0, credit=net_amount, narration="Vendor refund received",
            )
        )
    else:
        # Customer refund (reduces revenue) or Employee reimbursement (an expense):
        # Dr account_id, Cr Cash/Bank
        db.add(
            VoucherLine(
                voucher_id=voucher.id, account_id=refund_in.account_id,
                debit=net_amount, credit=0, narration=f"{refund_in.refund_type.value} refund",
            )
        )
        db.add(
            VoucherLine(
                voucher_id=voucher.id, account_id=refund_in.cash_account_id,
                debit=0, credit=net_amount, narration=f"{refund_in.refund_type.value} refund paid",
            )
        )

    db_refund.voucher_id = voucher.id
    db.commit()

    if booking:
        update_booking_status(db, booking, BookingStatus.CANCELLED, refund_in.refund_date)

    return get_refund(db, db_refund.id)


def delete_refund(db: Session, db_refund: Refund) -> None:
    voucher_id = db_refund.voucher_id
    db.delete(db_refund)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()
