import pytest
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.crud import land_property as land_crud
from app.crud import receipt as receipt_crud
from app.crud import rent_receipt as rent_receipt_crud
from app.crud import rental as rental_crud
from app.schemas.booking import BookingCreate
from app.schemas.land_property import LandPropertyPaymentCreate
from app.schemas.receipt import ReceiptCreate, ReceiptUpdate
from app.schemas.rental import RentAgreementCreate, RentReceiptCreate
from tests.conftest import TODAY

TRANSFER = dict(
    transfer_bank_name="Meezan Bank",
    transfer_account_title="Ali Khan",
    transfer_account_no="0101-123456",
    transfer_ref_no="FT12345",
    transfer_to_account_title="Hamdan Builders",
    transfer_to_account_no="0202-999999",
)
CHEQUE = dict(cheque_no="000123", cheque_bank_name="HBL")


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


# ---- Booking receipts -------------------------------------------------------

def test_bank_transfer_saves_from_and_to_accounts(db: Session, open_booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db, _receipt(open_booking, cash_account, mode_of_payment="Bank Transfer", **TRANSFER)
    )
    for field, value in TRANSFER.items():
        assert getattr(receipt, field) == value


def test_bank_transfer_requires_from_and_to_account(db: Session, open_booking, cash_account):
    with pytest.raises(ValueError, match="receiver's account name, receiver's account number"):
        receipt_crud.create_receipt(
            db,
            _receipt(
                open_booking, cash_account, mode_of_payment="Bank Transfer",
                transfer_account_title="Ali Khan", transfer_account_no="0101",
            ),
        )


def test_cheque_requires_number_and_bank(db: Session, open_booking, cash_account):
    with pytest.raises(ValueError, match="cheque number and the bank name"):
        receipt_crud.create_receipt(
            db, _receipt(open_booking, cash_account, mode_of_payment="Cheque", cheque_no="000123")
        )
    receipt = receipt_crud.create_receipt(
        db, _receipt(open_booking, cash_account, mode_of_payment="Cheque", **CHEQUE)
    )
    assert (receipt.cheque_no, receipt.cheque_bank_name) == ("000123", "HBL")


def test_cash_receipt_ignores_instrument_details(db: Session, open_booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db, _receipt(open_booking, cash_account, mode_of_payment="Cash", **TRANSFER, **CHEQUE)
    )
    assert receipt.transfer_account_no is None
    assert receipt.cheque_no is None


def test_switching_receipt_to_cash_clears_transfer_details(db: Session, open_booking, cash_account):
    receipt = receipt_crud.create_receipt(
        db, _receipt(open_booking, cash_account, mode_of_payment="Online", **TRANSFER)
    )
    updated = receipt_crud.update_receipt(db, receipt, ReceiptUpdate(mode_of_payment="Cash"))
    assert updated.transfer_account_title is None
    assert updated.transfer_to_account_no is None


# ---- Land / plot payments ---------------------------------------------------

def test_land_payment_by_cheque_needs_details(db: Session, land_property):
    base = dict(direction="To Seller", amount=50_000, payment_date=TODAY, mode_of_payment="Cheque")
    with pytest.raises(ValueError, match="cheque number"):
        land_crud.create_payment(db, land_property, LandPropertyPaymentCreate(**base))
    payment = land_crud.create_payment(db, land_property, LandPropertyPaymentCreate(**base, **CHEQUE))
    assert payment.cheque_bank_name == "HBL"


def test_land_payment_by_transfer_saves_accounts(db: Session, land_property):
    payment = land_crud.create_payment(
        db,
        land_property,
        LandPropertyPaymentCreate(
            direction="To Seller", amount=50_000, payment_date=TODAY, mode_of_payment="Bank Transfer", **TRANSFER
        ),
    )
    assert payment.transfer_to_account_no == "0202-999999"


# ---- Rent receipts ----------------------------------------------------------

def test_rent_receipt_by_transfer_needs_accounts(db: Session, tenant, land_property, cash_account, rental_income_account):
    agreement = rental_crud.create_agreement(
        db,
        RentAgreementCreate(
            agreement_date=TODAY, tenant_id=tenant.id, land_property_id=land_property.id,
            monthly_rent=25_000, start_date=TODAY, duration_months=2,
        ),
    )
    base = dict(receipt_date=TODAY, agreement_id=agreement.id, credit_account_id=cash_account.id, amount=25_000)
    with pytest.raises(ValueError, match="sender's account name"):
        rent_receipt_crud.create_receipt(db, RentReceiptCreate(**base, mode_of_payment="Bank Transfer"))
    receipt = rent_receipt_crud.create_receipt(
        db, RentReceiptCreate(**base, mode_of_payment="Bank Transfer", **TRANSFER)
    )
    assert receipt.transfer_account_title == "Ali Khan"
