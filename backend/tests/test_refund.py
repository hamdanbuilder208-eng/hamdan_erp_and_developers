import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.crud import refund as refund_crud
from app.models.account import Account, AccountNature
from app.models.booking import BookingStatus
from app.models.voucher import Voucher
from app.schemas.refund import RefundCreate
from tests.conftest import TODAY


@pytest.fixture()
def expense_account(db: Session) -> Account:
    obj = Account(code="5010", name="Refund Expense", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def test_customer_refund_requires_booking_id():
    with pytest.raises(ValidationError, match="must reference a booking"):
        RefundCreate(
            refund_date=TODAY,
            refund_type="Customer",
            account_id=1,
            cash_account_id=2,
            gross_amount=1000,
        )


def test_vendor_refund_requires_party_name():
    with pytest.raises(ValidationError, match="must have a party name"):
        RefundCreate(
            refund_date=TODAY,
            refund_type="Vendor",
            account_id=1,
            cash_account_id=2,
            gross_amount=1000,
        )


def test_refund_rejects_deduction_over_gross_amount():
    with pytest.raises(ValidationError, match="cannot exceed the gross amount"):
        RefundCreate(
            refund_date=TODAY,
            refund_type="Vendor",
            party_name="ABC Traders",
            account_id=1,
            cash_account_id=2,
            gross_amount=1000,
            deduction_amount=1500,
        )


def test_customer_refund_computes_net_amount_and_cancels_booking(
    db: Session, booking, expense_account, cash_account
):
    result = refund_crud.create_refund(
        db,
        RefundCreate(
            refund_date=TODAY,
            refund_type="Customer",
            booking_id=booking.id,
            account_id=expense_account.id,
            cash_account_id=cash_account.id,
            gross_amount=100_000,
            deduction_amount=10_000,
        ),
    )

    assert result.net_amount == 90_000
    db.refresh(booking)
    assert booking.status == BookingStatus.CANCELLED


def test_customer_refund_rejects_already_cancelled_booking(
    db: Session, booking, expense_account, cash_account
):
    booking.status = BookingStatus.CANCELLED
    db.commit()

    with pytest.raises(ValueError, match="already cancelled"):
        refund_crud.create_refund(
            db,
            RefundCreate(
                refund_date=TODAY,
                refund_type="Customer",
                booking_id=booking.id,
                account_id=expense_account.id,
                cash_account_id=cash_account.id,
                gross_amount=50_000,
            ),
        )


def test_vendor_refund_does_not_require_or_touch_a_booking(
    db: Session, expense_account, cash_account
):
    result = refund_crud.create_refund(
        db,
        RefundCreate(
            refund_date=TODAY,
            refund_type="Vendor",
            party_name="ABC Traders",
            account_id=expense_account.id,
            cash_account_id=cash_account.id,
            gross_amount=20_000,
        ),
    )
    assert result.booking is None
    assert result.net_amount == 20_000


def test_refund_posts_balanced_voucher(db: Session, booking, expense_account, cash_account):
    result = refund_crud.create_refund(
        db,
        RefundCreate(
            refund_date=TODAY,
            refund_type="Customer",
            booking_id=booking.id,
            account_id=expense_account.id,
            cash_account_id=cash_account.id,
            gross_amount=100_000,
            deduction_amount=10_000,
        ),
    )

    voucher = db.get(Voucher, result.voucher_id)
    total_debit = sum(l.debit for l in voucher.lines)
    total_credit = sum(l.credit for l in voucher.lines)
    assert total_debit == total_credit == 90_000  # net_amount, not gross


def test_delete_refund_removes_voucher(db: Session, booking, expense_account, cash_account):
    result = refund_crud.create_refund(
        db,
        RefundCreate(
            refund_date=TODAY,
            refund_type="Customer",
            booking_id=booking.id,
            account_id=expense_account.id,
            cash_account_id=cash_account.id,
            gross_amount=50_000,
        ),
    )
    voucher_id = result.voucher_id

    refund_crud.delete_refund(db, result)

    assert db.get(Voucher, voucher_id) is None
