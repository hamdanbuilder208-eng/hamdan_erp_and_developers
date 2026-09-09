import pytest
from sqlalchemy.orm import Session

from app.crud import rent_receipt as rent_receipt_crud
from app.crud import rental as rental_crud
from app.models.voucher import Voucher
from app.schemas.rental import RentAgreementCreate, RentReceiptCreate
from tests.conftest import TODAY


@pytest.fixture()
def agreement(db: Session, tenant, land_property):
    """A real rent agreement — 2 months at 25,000/month, no deposit."""
    return rental_crud.create_agreement(
        db,
        RentAgreementCreate(
            agreement_date=TODAY,
            tenant_id=tenant.id,
            land_property_id=land_property.id,
            monthly_rent=25_000,
            start_date=TODAY,
            duration_months=2,
        ),
    )


def _receipt_in(agreement, cash_account, **overrides) -> RentReceiptCreate:
    data = dict(
        receipt_date=TODAY,
        agreement_id=agreement.id,
        credit_account_id=cash_account.id,
        amount=25_000,
    )
    data.update(overrides)
    return RentReceiptCreate(**data)


def test_create_receipt_requires_rental_income_account(db: Session, agreement, cash_account):
    with pytest.raises(ValueError, match="Rental Income"):
        rent_receipt_crud.create_receipt(db, _receipt_in(agreement, cash_account))


def test_create_receipt_allocates_to_oldest_month_first(
    db: Session, agreement, cash_account, rental_income_account
):
    rent_receipt_crud.create_receipt(db, _receipt_in(agreement, cash_account, amount=25_000))

    db.refresh(agreement)
    lines = sorted(agreement.schedule_lines, key=lambda l: l.month_no)
    assert lines[0].paid_amount == 25_000
    assert lines[1].paid_amount == 0


def test_create_receipt_spills_into_next_month(
    db: Session, agreement, cash_account, rental_income_account
):
    rent_receipt_crud.create_receipt(db, _receipt_in(agreement, cash_account, amount=30_000))

    db.refresh(agreement)
    lines = sorted(agreement.schedule_lines, key=lambda l: l.month_no)
    assert lines[0].paid_amount == 25_000
    assert lines[1].paid_amount == 5_000


def test_create_receipt_posts_balanced_voucher(
    db: Session, agreement, cash_account, rental_income_account
):
    result = rent_receipt_crud.create_receipt(db, _receipt_in(agreement, cash_account))

    voucher = db.get(Voucher, result.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 25_000
    credit_line = next(l for l in voucher.lines if l.credit > 0)
    assert credit_line.account.code == "4030"


def test_delete_receipt_reverses_allocation_and_voucher(
    db: Session, agreement, cash_account, rental_income_account
):
    receipt = rent_receipt_crud.create_receipt(db, _receipt_in(agreement, cash_account))
    voucher_id = receipt.voucher_id

    rent_receipt_crud.delete_receipt(db, receipt)

    db.refresh(agreement)
    assert all(l.paid_amount == 0 for l in agreement.schedule_lines)
    assert db.get(Voucher, voucher_id) is None
