import pytest
from sqlalchemy.orm import Session

from app.crud import receipt as receipt_crud
from app.models.booking import BookingStatus
from app.models.receipt import ChequeStatus
from app.models.voucher import Voucher
from app.schemas.receipt import ReceiptCreate
from tests.conftest import TODAY


def _receipt_in(booking, cash_account, **overrides) -> ReceiptCreate:
    data = dict(
        receipt_date=TODAY,
        booking_id=booking.id,
        credit_account_id=cash_account.id,
        amount=100_000,
        mode_of_payment="Cash",
    )
    data.update(overrides)
    return ReceiptCreate(**data)


def test_create_receipt_allocates_to_oldest_installment_first(
    db: Session, booking, cash_account
):
    receipt_crud.create_receipt(db, _receipt_in(booking, cash_account, amount=100_000))

    db.refresh(booking)
    lines = sorted(booking.schedule_lines, key=lambda l: l.installment_no)
    assert lines[0].paid_amount == 100_000
    assert lines[1].paid_amount == 0


def test_create_receipt_spills_into_next_installment_once_first_is_settled(
    db: Session, booking, cash_account
):
    # Each installment is 500,000 (1,000,000 / 2); 600,000 should fully settle
    # the first and leave 100,000 applied to the second.
    receipt_crud.create_receipt(db, _receipt_in(booking, cash_account, amount=600_000))

    db.refresh(booking)
    lines = sorted(booking.schedule_lines, key=lambda l: l.installment_no)
    assert lines[0].paid_amount == 500_000
    assert lines[1].paid_amount == 100_000


def test_create_receipt_rejects_cancelled_booking(db: Session, booking, cash_account):
    booking.status = BookingStatus.CANCELLED
    db.commit()

    with pytest.raises(ValueError, match="cancelled"):
        receipt_crud.create_receipt(db, _receipt_in(booking, cash_account))


def test_create_receipt_requires_receivable_account_in_chart(db, project, unit, allottee):
    """Uses the raw `unit`/`allottee`/`project` fixtures (no accounting_accounts,
    so no 1030 Accounts Receivable exists) with a hand-built booking that never
    went through booking_crud, isolating this to the receipt-side lookup."""
    from app.models.account import Account, AccountNature
    from app.models.booking import Booking, PaymentScheduleLine, ScheduleFrequency

    cash = Account(code="1010", name="Cash", nature=AccountNature.ASSET)
    db.add(cash)
    booking_row = Booking(
        booking_ref_no="BKG-00099",
        booking_date=TODAY,
        project_id=project.id,
        unit_id=unit.id,
        allottee_id=allottee.id,
        status_date=TODAY,
        total_price=1_000_000,
        frequency=ScheduleFrequency.MONTHLY,
    )
    db.add(booking_row)
    db.flush()
    db.add(
        PaymentScheduleLine(
            booking_id=booking_row.id, installment_no=1, due_date=TODAY, amount=1_000_000
        )
    )
    db.commit()

    with pytest.raises(ValueError, match="Accounts Receivable"):
        receipt_crud.create_receipt(db, _receipt_in(booking_row, cash))


def test_create_receipt_posts_balanced_voucher(db: Session, booking, cash_account):
    result = receipt_crud.create_receipt(
        db, _receipt_in(booking, cash_account, amount=100_000)
    )

    voucher = db.get(Voucher, result.voucher_id)
    total_debit = sum(l.debit for l in voucher.lines)
    total_credit = sum(l.credit for l in voucher.lines)
    assert total_debit == total_credit == 100_000


def test_cheque_receipt_starts_pending(db: Session, booking, cash_account):
    result = receipt_crud.create_receipt(
        db, _receipt_in(booking, cash_account, mode_of_payment="Cheque", cheque_no="123")
    )
    assert result.cheque_status == ChequeStatus.PENDING


def test_bounced_cheque_reverses_allocation_and_voucher(db: Session, booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db, _receipt_in(booking, cash_account, mode_of_payment="Cheque", cheque_no="123")
    )
    voucher_id = receipt.voucher_id

    updated = receipt_crud.mark_cheque_status(db, receipt, ChequeStatus.BOUNCED)

    db.refresh(booking)
    assert all(l.paid_amount == 0 for l in booking.schedule_lines)
    assert updated.voucher_id is None
    assert db.get(Voucher, voucher_id) is None


def test_recleared_cheque_reapplies_ledger(db: Session, booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db, _receipt_in(booking, cash_account, mode_of_payment="Cheque", cheque_no="123")
    )
    receipt_crud.mark_cheque_status(db, receipt, ChequeStatus.BOUNCED)

    updated = receipt_crud.mark_cheque_status(db, receipt, ChequeStatus.CLEARED)

    db.refresh(booking)
    lines = sorted(booking.schedule_lines, key=lambda l: l.installment_no)
    assert lines[0].paid_amount == 100_000
    assert updated.voucher_id is not None


def test_delete_receipt_reverses_allocation_and_voucher(db: Session, booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db, _receipt_in(booking, cash_account, amount=100_000)
    )
    voucher_id = receipt.voucher_id

    receipt_crud.delete_receipt(db, receipt)

    db.refresh(booking)
    assert all(l.paid_amount == 0 for l in booking.schedule_lines)
    assert db.get(Voucher, voucher_id) is None
