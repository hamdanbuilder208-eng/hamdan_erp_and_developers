import pytest
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.crud import receipt as receipt_crud
from app.schemas.booking import BookingCreate
from app.schemas.receipt import ReceiptCreate, ReceiptUpdate
from tests.conftest import TODAY


@pytest.fixture()
def open_booking(db: Session, project, unit, allottee, accounting_accounts):
    return booking_crud.create_booking(
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


def _receipt(booking, cash_account, **overrides) -> ReceiptCreate:
    data = dict(
        receipt_date=TODAY, booking_id=booking.id, credit_account_id=cash_account.id, amount=100_000
    )
    data.update(overrides)
    return ReceiptCreate(**data)


def test_bank_transfer_saves_sender_account_details(db: Session, open_booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db,
        _receipt(
            open_booking,
            cash_account,
            mode_of_payment="Bank Transfer",
            transfer_bank_name="Meezan Bank",
            transfer_account_title="Ali Khan",
            transfer_account_no="0101-123456",
            transfer_ref_no="FT12345",
        ),
    )
    assert receipt.transfer_bank_name == "Meezan Bank"
    assert receipt.transfer_account_title == "Ali Khan"
    assert receipt.transfer_account_no == "0101-123456"
    assert receipt.transfer_ref_no == "FT12345"


def test_bank_transfer_requires_bank_and_account_title(db: Session, open_booking, cash_account):
    with pytest.raises(ValueError, match="bank name and account title"):
        receipt_crud.create_receipt(
            db, _receipt(open_booking, cash_account, mode_of_payment="Bank Transfer", transfer_bank_name="HBL")
        )


def test_cash_receipt_ignores_transfer_details(db: Session, open_booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db, _receipt(open_booking, cash_account, mode_of_payment="Cash", transfer_bank_name="HBL")
    )
    assert receipt.transfer_bank_name is None


def test_switching_receipt_to_cash_clears_transfer_details(db: Session, open_booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db,
        _receipt(
            open_booking,
            cash_account,
            mode_of_payment="Online",
            transfer_bank_name="UBL",
            transfer_account_title="Ali Khan",
        ),
    )
    updated = receipt_crud.update_receipt(db, receipt, ReceiptUpdate(mode_of_payment="Cash"))
    assert updated.transfer_bank_name is None
    assert updated.transfer_account_title is None
