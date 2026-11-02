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


# Security deposits and cheques


def _lines_by_account(db, voucher_id):
    from app.models.account import Account
    from app.models.voucher import VoucherLine

    lines = db.query(VoucherLine).filter(VoucherLine.voucher_id == voucher_id).all()
    return {db.get(Account, l.account_id).code: (float(l.debit), float(l.credit)) for l in lines}


def test_security_deposit_is_a_liability_not_rent(db: Session, agreement, cash_account):
    from app.models.rental import RentReceiptType

    receipt = rent_receipt_crud.create_receipt(
        db,
        _receipt_in(agreement, cash_account, amount=50_000, receipt_type=RentReceiptType.SECURITY_DEPOSIT),
    )

    # Works without a Rental Income account: deposits don't touch it.
    assert _lines_by_account(db, receipt.voucher_id) == {
        "1010": (50_000, 0),
        "2040": (0, 50_000),
    }
    db.refresh(agreement)
    assert all(float(l.paid_amount) == 0 for l in agreement.schedule_lines)


def _cheque(agreement, cash_account, **overrides):
    return _receipt_in(
        agreement,
        cash_account,
        mode_of_payment="Cheque",
        cheque_no="200000",
        cheque_bank_name="UBL",
        cheque_clearing_date=TODAY,
        **overrides,
    )


def test_rent_cheque_starts_pending_and_shows_in_reminders(
    db: Session, agreement, cash_account, rental_income_account
):
    from app.models.receipt import ChequeStatus

    receipt = rent_receipt_crud.create_receipt(db, _cheque(agreement, cash_account))

    assert receipt.cheque_status == ChequeStatus.PENDING
    assert [r.id for r in rent_receipt_crud.list_pending_cheques(db, due_by=TODAY)] == [receipt.id]

    rent_receipt_crud.mark_cheque_status(db, receipt, ChequeStatus.CLEARED)
    assert rent_receipt_crud.list_pending_cheques(db) == []


def test_bounced_rent_cheque_reverses_and_re_presented_reapplies(
    db: Session, agreement, cash_account, rental_income_account
):
    from app.models.receipt import ChequeStatus

    receipt = rent_receipt_crud.create_receipt(db, _cheque(agreement, cash_account))
    voucher_id = receipt.voucher_id

    receipt = rent_receipt_crud.mark_cheque_status(db, receipt, ChequeStatus.BOUNCED)
    assert receipt.voucher_id is None
    assert db.get(Voucher, voucher_id) is None
    db.refresh(agreement)
    assert all(float(l.paid_amount) == 0 for l in agreement.schedule_lines)

    receipt = rent_receipt_crud.mark_cheque_status(db, receipt, ChequeStatus.CLEARED)
    assert receipt.voucher_id is not None
    db.refresh(agreement)
    assert sorted(float(l.paid_amount) for l in agreement.schedule_lines) == [0, 25_000]


def test_cash_rent_has_no_cheque_status(db: Session, agreement, cash_account, rental_income_account):
    receipt = rent_receipt_crud.create_receipt(db, _receipt_in(agreement, cash_account, cheque_clearing_date=TODAY))
    assert receipt.cheque_status is None
    with pytest.raises(ValueError, match="not paid by cheque"):
        from app.models.receipt import ChequeStatus

        rent_receipt_crud.mark_cheque_status(db, receipt, ChequeStatus.CLEARED)


def test_land_payment_cheque_status(db: Session, land_property):
    from app.crud import land_property as land_crud
    from app.models.booking import PaymentMode
    from app.models.land_property import LandPropertyPaymentDirection
    from app.models.receipt import ChequeStatus
    from app.schemas.land_property import LandPropertyPaymentCreate

    payment = land_crud.create_payment(
        db,
        land_property,
        LandPropertyPaymentCreate(
            direction=LandPropertyPaymentDirection.FROM_BUYER,
            amount=100_000,
            payment_date=TODAY,
            mode_of_payment=PaymentMode.CHEQUE,
            cheque_no="9",
            cheque_bank_name="HBL",
            cheque_clearing_date=TODAY,
        ),
    )
    assert payment.cheque_status == ChequeStatus.PENDING
    assert [p.id for p in land_crud.list_pending_cheques(db, due_by=TODAY)] == [payment.id]

    land_crud.mark_cheque_status(db, payment, ChequeStatus.BOUNCED)
    assert land_crud.list_pending_cheques(db) == []
    with pytest.raises(ValueError, match="already marked Bounced"):
        land_crud.mark_cheque_status(db, payment, ChequeStatus.BOUNCED)
