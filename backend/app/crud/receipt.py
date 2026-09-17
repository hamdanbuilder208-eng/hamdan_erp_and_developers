from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account
from app.models.booking import Booking, PaymentScheduleLine
from app.models.receipt import ChequeStatus, Receipt, ReceiptAllocation
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.receipt import ReceiptCreate, ReceiptUpdate

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


def list_receipts(
    db: Session, booking_id: int | None = None, project_id: int | None = None
) -> list[Receipt]:
    query = _load_query(db)
    if booking_id is not None:
        query = query.filter(Receipt.booking_id == booking_id)
    if project_id is not None:
        query = query.join(Booking).filter(Booking.project_id == project_id)
    return query.order_by(Receipt.id.desc()).all()


def get_receipt(db: Session, receipt_id: int) -> Receipt | None:
    return _load_query(db).filter(Receipt.id == receipt_id).first()


def _distribute_amount(
    db: Session,
    booking: Booking,
    receipt_id: int,
    amount: float,
    schedule_line_id: int | None = None,
) -> None:
    """Applies `amount` to schedule lines in due order (oldest first) and records
    exactly how much landed on each line as a ReceiptAllocation, so this specific
    receipt's contribution can be reversed precisely later — see delete_receipt.

    When schedule_line_id is given, that line is settled first (out of due-date
    order if needed) — e.g. targeting the 2nd installment specifically — and any
    amount left over still spills into the rest, oldest first."""
    remaining = amount
    lines = sorted(booking.schedule_lines, key=lambda l: l.due_date)
    if schedule_line_id is not None:
        target = next((l for l in lines if l.id == schedule_line_id), None)
        if target:
            lines = [target] + [l for l in lines if l.id != schedule_line_id]
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


def _apply_receipt_ledger(
    db: Session, booking: Booking, db_receipt: Receipt, schedule_line_id: int | None = None
) -> None:
    """Books the receipt's amount for real: installment allocation + a Receipt
    voucher (debit the cash/bank account, credit Accounts Receivable). Used both
    when a receipt is first created and when a previously-bounced cheque is
    re-presented and clears — same booking either way."""
    receivable_account = db.query(Account).filter(Account.code == RECEIVABLE_ACCOUNT_CODE).first()
    if not receivable_account:
        raise ValueError(
            f"Accounts Receivable account (code {RECEIVABLE_ACCOUNT_CODE}) not found in chart of accounts"
        )

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.RECEIPT,
        voucher_date=db_receipt.receipt_date,
        project_id=booking.project_id,
        narration=f"Receipt {db_receipt.receipt_no} — {booking.booking_ref_no}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=db_receipt.credit_account_id,
            debit=db_receipt.amount,
            credit=0,
            narration=f"Receipt against {booking.booking_ref_no}",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=receivable_account.id,
            debit=0,
            credit=db_receipt.amount,
            narration=f"Receipt against {booking.booking_ref_no}",
        )
    )

    db_receipt.voucher_id = voucher.id
    db.flush()
    _distribute_amount(db, booking, db_receipt.id, float(db_receipt.amount), schedule_line_id)


def create_receipt(db: Session, receipt_in: ReceiptCreate) -> Receipt:
    booking = db.query(Booking).filter(Booking.id == receipt_in.booking_id).first()
    if not booking:
        raise ValueError("Booking not found")
    if booking.status.value == "Cancelled":
        raise ValueError("Cannot record a receipt against a cancelled booking")

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
        cheque_clearing_date=receipt_in.cheque_clearing_date,
        cheque_status=ChequeStatus.PENDING if receipt_in.mode_of_payment == "Cheque" else None,
        narration=receipt_in.narration,
    )
    db.add(db_receipt)
    db.flush()

    _apply_receipt_ledger(db, booking, db_receipt, receipt_in.schedule_line_id)

    db.commit()
    return get_receipt(db, db_receipt.id)


def update_receipt(db: Session, db_receipt: Receipt, receipt_in: ReceiptUpdate) -> Receipt:
    """Admin-only correction of a receipt already recorded (wrong amount, date,
    booking, cheque details, etc). Reverses whatever this receipt currently has
    booked (allocations + voucher — same pattern as mark_cheque_status), applies
    the edited fields, then re-books it exactly like a fresh receipt would be."""
    data = receipt_in.model_dump(exclude_unset=True)

    new_booking_id = data.get("booking_id", db_receipt.booking_id)
    booking = db.query(Booking).filter(Booking.id == new_booking_id).first()
    if not booking:
        raise ValueError("Booking not found")
    if booking.status.value == "Cancelled":
        raise ValueError("Cannot record a receipt against a cancelled booking")

    was_applied = db_receipt.voucher_id is not None
    if was_applied:
        _reverse_receipt_allocations(db, db_receipt)
        voucher_id = db_receipt.voucher_id
        db_receipt.voucher_id = None
        db.flush()
        if voucher_id:
            voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
            if voucher:
                db.delete(voucher)

    for field, value in data.items():
        setattr(db_receipt, field, value)

    if db_receipt.mode_of_payment == "Cheque":
        if db_receipt.cheque_status is None:
            db_receipt.cheque_status = ChequeStatus.PENDING
        should_apply = db_receipt.cheque_status != ChequeStatus.BOUNCED
    else:
        db_receipt.cheque_status = None
        db_receipt.cheque_no = None
        db_receipt.cheque_date = None
        db_receipt.cheque_clearing_date = None
        should_apply = True

    db.flush()

    if should_apply:
        _apply_receipt_ledger(db, booking, db_receipt)

    db.commit()
    return get_receipt(db, db_receipt.id)


def list_pending_cheques(db: Session, due_by: date | None = None) -> list[Receipt]:
    """Cheques still awaiting clearing, optionally only those due on/before a
    given date (used for the dashboard reminder — overdue + due today)."""
    query = _load_query(db).filter(Receipt.cheque_status == ChequeStatus.PENDING)
    if due_by is not None:
        query = query.filter(Receipt.cheque_clearing_date <= due_by)
    return query.order_by(Receipt.cheque_clearing_date.asc()).all()


def mark_cheque_status(db: Session, db_receipt: Receipt, new_status: ChequeStatus) -> Receipt:
    """Pending -> Cleared/Bounced is the usual first call. A Bounced cheque can
    later be re-presented and marked Cleared — this re-books the payment from
    scratch. A Cleared cheque can also be corrected back to Bounced if it was
    marked in error — this reverses it again. Either way the ledger always
    matches the current status: applied unless the status is Bounced."""
    if db_receipt.mode_of_payment != "Cheque":
        raise ValueError("This receipt was not paid by cheque")
    if db_receipt.cheque_status == new_status:
        raise ValueError(f"This cheque is already marked {new_status.value}")
    if new_status not in (ChequeStatus.CLEARED, ChequeStatus.BOUNCED):
        raise ValueError("Status must be Cleared or Bounced")

    was_applied = db_receipt.cheque_status != ChequeStatus.BOUNCED
    will_be_applied = new_status != ChequeStatus.BOUNCED

    if was_applied and not will_be_applied:
        # Cleared/Pending -> Bounced: the money was never actually received —
        # undo exactly what this receipt did, but keep the row as a record.
        _reverse_receipt_allocations(db, db_receipt)
        voucher_id = db_receipt.voucher_id
        db_receipt.voucher_id = None
        db.flush()
        if voucher_id:
            voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
            if voucher:
                db.delete(voucher)
    elif not was_applied and will_be_applied:
        # Bounced -> Cleared: the cheque was re-presented and this time cleared.
        booking = db.query(Booking).filter(Booking.id == db_receipt.booking_id).first()
        if not booking:
            raise ValueError("Booking not found")
        _apply_receipt_ledger(db, booking, db_receipt)

    db_receipt.cheque_status = new_status
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
