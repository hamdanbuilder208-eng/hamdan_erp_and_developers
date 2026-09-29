from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.crud import receipt as receipt_crud
from app.crud import refund as refund_crud
from app.crud import unit as unit_crud
from app.models.booking import BookingStatus
from app.schemas.booking import BookingCreate
from app.schemas.receipt import ReceiptCreate
from app.schemas.refund import RefundOut
from app.schemas.unit import UnitUpdate
from tests.conftest import TODAY


def _paid_booking(db, project, unit, allottee, cash_account):
    booking = booking_crud.create_booking(
        db,
        BookingCreate(
            booking_date=TODAY,
            project_id=project.id,
            unit_id=unit.id,
            allottee_id=allottee.id,
            status_date=TODAY,
            down_payment_amount=300_000,
        ),
    )
    receipt_crud.create_receipt(
        db,
        ReceiptCreate(
            receipt_date=TODAY,
            booking_id=booking.id,
            credit_account_id=cash_account.id,
            amount=300_000,
        ),
    )
    return booking


def _check(db, booking):
    db.refresh(booking)
    assert booking.status == BookingStatus.CANCELLED
    refunds = refund_crud.list_refunds(db)
    assert len(refunds) == 1
    out = RefundOut.model_validate(refunds[0])
    assert out.gross_amount == 300_000
    assert out.booking_id == booking.id


def test_unit_set_available_cancels_booking_and_creates_refund(
    db: Session, project, unit, allottee, accounting_accounts, cash_account
):
    booking = _paid_booking(db, project, unit, allottee, cash_account)
    unit_crud.update_unit(db, unit, UnitUpdate(status="Available"))
    _check(db, booking)


def test_unit_set_cancelled_cancels_booking_and_creates_refund(
    db: Session, project, unit, allottee, accounting_accounts, cash_account
):
    booking = _paid_booking(db, project, unit, allottee, cash_account)
    unit_crud.update_unit(db, unit, UnitUpdate(status="Cancelled"))
    _check(db, booking)


def test_booking_cancelled_from_bookings_creates_refund(
    db: Session, project, unit, allottee, accounting_accounts, cash_account
):
    booking = _paid_booking(db, project, unit, allottee, cash_account)
    booking_crud.update_booking_status(db, booking, BookingStatus.CANCELLED, TODAY)
    _check(db, booking)


def test_auto_refund_can_be_paid_out_in_installments(
    db: Session, project, unit, allottee, accounting_accounts, cash_account
):
    from app.models.account import Account, AccountNature
    from app.models.refund import RefundStatus
    from app.schemas.refund import RefundPaymentCreate

    sales_return = Account(code="4090", name="Sales Return", nature=AccountNature.REVENUE)
    db.add(sales_return)
    db.commit()

    booking = _paid_booking(db, project, unit, allottee, cash_account)
    unit_crud.update_unit(db, unit, UnitUpdate(status="Cancelled"))
    refund = refund_crud.list_refunds(db)[0]

    for amount in (100_000, 200_000):
        refund = refund_crud.add_payment(
            db,
            refund,
            RefundPaymentCreate(
                payment_date=TODAY, amount=amount, account_id=sales_return.id, cash_account_id=cash_account.id
            ),
        )
        RefundOut.model_validate(refund)
    assert refund.status == RefundStatus.PAID
