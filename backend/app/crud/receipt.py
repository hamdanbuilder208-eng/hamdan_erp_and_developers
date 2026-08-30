from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account
from app.models.booking import Booking, PaymentScheduleLine
from app.models.receipt import Receipt, ReceiptAllocation
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.receipt import ReceiptCreate

RECEIVABLE_ACCOUNT_CODE = "1030"


def _next_receipt_no(db: Session) -> str:
    return next_sequence_number(db, Receipt.receipt_no, "RCT-", 5)


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "RV-", 5)


def _load_query(db: Session):
    return db.query(Receipt).options(
        joinedload(Receipt.credit_account),
        joinedload(Receipt.booking).joinedload(Booking.schedule_lines),
        joinedload(Receipt.booking).joinedload(Booking.project),
        joinedload(Receipt.booking).joinedload(Booking.unit),
        joinedload(Receipt.booking).joinedload(Booking.allottee),
    )


def list_receipts(db: Session, booking_id: int | None = None) -> list[Receipt]:
    query = _load_query(db)
    if booking_id is not None:
        query = query.filter(Receipt.booking_id == booking_id)
    return query.order_by(Receipt.id.desc()).all()


def get_receipt(db: Session, receipt_id: int) -> Receipt | None:
    return _load_query(db).filter(Receipt.id == receipt_id).first()


def _distribute_amount(db: Session, booking: Booking, receipt_id: int, amount: float) -> None:
    """Applies `amount` to schedule lines in due order (oldest first) and records
    exactly how much landed on each line as a ReceiptAllocation, so this specific
    receipt's contribution can be reversed precisely later — see delete_receipt."""
    remaining = amount
    lines = sorted(booking.schedule_lines, key=lambda l: l.installment_no)
    for line in lines:
        if remaining <= 0:
            break
        due = float(line.amount) - float(line.paid_amount)
        if due <= 0:
            continue
        applied = min(due, remaining)
        line.paid_amount = float(line.paid_amount) + applied
        remaining -= applied
        db.add(ReceiptAllocation(receipt_id=receipt_id, schedule_line_id=line.id, amount=applied))


def _reverse_receipt_allocations(db: Session, db_receipt: Receipt) -> None:
    allocations = (
        db.query(ReceiptAllocation).filter(ReceiptAllocation.receipt_id == db_receipt.id).all()
    )
    for allocation in allocations:
        line = (
            db.query(PaymentScheduleLine)
            .filter(PaymentScheduleLine.id == allocation.schedule_line_id)
            .first()
        )
        if line:
            line.paid_amount = float(line.paid_amount) - float(allocation.amount)
        db.delete(allocation)


def create_receipt(db: Session, receipt_in: ReceiptCreate) -> Receipt:
    booking = db.query(Booking).filter(Booking.id == receipt_in.booking_id).first()
    if not booking:
        raise ValueError("Booking not found")
    if booking.status.value == "Cancelled":
        raise ValueError("Cannot record a receipt against a cancelled booking")

    receivable_account = (
        db.query(Account).filter(Account.code == RECEIVABLE_ACCOUNT_CODE).first()
    )
    if not receivable_account:
        raise ValueError(
            f"Accounts Receivable account (code {RECEIVABLE_ACCOUNT_CODE}) not found in chart of accounts"
        )

    db_receipt = Receipt(
        receipt_no=_next_receipt_no(db),
        receipt_date=receipt_in.receipt_date,
        booking_id=receipt_in.booking_id,
        credit_account_id=receipt_in.credit_account_id,
        amount=receipt_in.amount,
        payment_type=receipt_in.payment_type,
        mode_of_payment=receipt_in.mode_of_payment,
        cheque_no=receipt_in.cheque_no,
        cheque_date=receipt_in.cheque_date,
        narration=receipt_in.narration,
    )
    db.add(db_receipt)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.RECEIPT,
        voucher_date=receipt_in.receipt_date,
        project_id=booking.project_id,
        narration=f"Receipt {db_receipt.receipt_no} — {booking.booking_ref_no}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=receipt_in.credit_account_id,
            debit=receipt_in.amount,
            credit=0,
            narration=f"Receipt against {booking.booking_ref_no}",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=receivable_account.id,
            debit=0,
            credit=receipt_in.amount,
            narration=f"Receipt against {booking.booking_ref_no}",
        )
    )

    db_receipt.voucher_id = voucher.id
    _distribute_amount(db, booking, db_receipt.id, receipt_in.amount)

    db.commit()
    return get_receipt(db, db_receipt.id)


def delete_receipt(db: Session, db_receipt: Receipt) -> None:
    _reverse_receipt_allocations(db, db_receipt)

    # The receipt row must be gone before its voucher is deleted — receipts.voucher_id
    # is a live FK, so deleting the voucher first trips a FK constraint violation.
    voucher_id = db_receipt.voucher_id
    db.delete(db_receipt)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()
