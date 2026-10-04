import pytest
from sqlalchemy.orm import Session

from app.crud import contractor as contractor_crud
from app.crud import partner as partner_crud
from app.crud import project as project_crud
from app.schemas.contractor import (
    ContractAgreementCreate,
    ContractorBillCreate,
    ContractorCreate,
    ContractorPaymentCreate,
)
from tests.conftest import TODAY


@pytest.fixture()
def contractor(db: Session):
    return contractor_crud.create_contractor(
        db, ContractorCreate(name="Modern Construction Co.", cnic="42101-1234567-1", trade="Grey Structure")
    )


@pytest.fixture()
def agreement(db: Session, project, contractor):
    # 10,000 sq ft of structure at PKR 1,000 / sq ft, 5% retention, 7.5% WHT.
    return contractor_crud.create_agreement(
        db,
        ContractAgreementCreate(
            agreement_date=TODAY, project_id=project.id, contractor_id=contractor.id,
            scope_title="Structure, Ground to 2nd Floor", work_type="Grey Structure",
            floors_scope="Ground to 2nd Floor", basis="Per Sq. Ft.", quantity=10_000, rate=1_000,
            retention_percent=5, wht_percent=7.5,
        ),
    )


def _pay(db, agreement, amount, purpose="Bill Payment", account=None):
    return contractor_crud.add_payment(
        db, agreement,
        ContractorPaymentCreate(
            payment_date=TODAY, purpose=purpose, amount=amount, credit_account_id=account.id,
        ),
    )


def test_contract_amount_is_quantity_times_rate(agreement, contractor):
    assert float(agreement.contract_amount) == 10_000_000
    assert agreement.contractor.contractor_code == contractor.contractor_code


def test_bill_deducts_retention_and_wht_and_payments_follow_the_account(
    db: Session, project, agreement, cash_account
):
    bill = contractor_crud.add_bill(db, agreement, ContractorBillCreate(bill_date=TODAY, gross_amount=2_000_000))
    assert (float(bill.retention_amount), float(bill.wht_amount), float(bill.net_amount)) == (
        100_000, 150_000, 1_750_000,
    )

    agreement = contractor_crud.get_agreement(db, agreement.id)
    assert agreement.due_now == 1_750_000

    # Can't pay more than what's due on the bills…
    with pytest.raises(ValueError, match="is due on the bills"):
        _pay(db, agreement, 1_800_000, account=cash_account)

    _pay(db, agreement, 1_750_000, account=cash_account)
    agreement = contractor_crud.get_agreement(db, agreement.id)
    assert (agreement.due_now, agreement.retention_held) == (0, 100_000)

    # …and retention is paid out separately when released.
    _pay(db, agreement, 100_000, purpose="Retention Release", account=cash_account)
    agreement = contractor_crud.get_agreement(db, agreement.id)
    assert (agreement.due_now, agreement.retention_held, agreement.paid_total) == (0, 0, 1_850_000)

    # Payments are the project's cost.
    assert project_crud.project_total_spent(db, project.id) == 1_850_000
    assert partner_crud.compute_project_profit(db, project.id)[1] == 1_850_000


def test_advance_then_bill(db: Session, agreement, cash_account):
    _pay(db, agreement, 500_000, purpose="Advance", account=cash_account)
    agreement = contractor_crud.get_agreement(db, agreement.id)
    assert agreement.due_now == -500_000  # advance not yet covered by work

    contractor_crud.add_bill(db, agreement, ContractorBillCreate(bill_date=TODAY, gross_amount=1_000_000))
    agreement = contractor_crud.get_agreement(db, agreement.id)
    assert agreement.due_now == 375_000  # 875,000 net − 500,000 advance


def test_cannot_bill_beyond_the_contract(db: Session, agreement):
    with pytest.raises(ValueError, match="left to bill"):
        contractor_crud.add_bill(db, agreement, ContractorBillCreate(bill_date=TODAY, gross_amount=10_000_001))


def test_contractor_summary_totals(db: Session, agreement, contractor, cash_account):
    contractor_crud.add_bill(db, agreement, ContractorBillCreate(bill_date=TODAY, gross_amount=1_000_000))
    _pay(db, agreement, 800_000, account=cash_account)
    row = next(c for c in contractor_crud.list_contractors(db) if c.id == contractor.id)
    assert (row.agreement_count, row.total_contract, row.total_billed, row.total_paid) == (
        1, 10_000_000, 1_000_000, 800_000,
    )
    assert row.total_due == 75_000  # 875,000 net − 800,000


def test_contractor_phone_must_be_11_digits():
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="11 digits"):
        ContractorCreate(name="X", cnic="42101-1234567-1", trade="Paint", phone="0230616515050505")
    assert ContractorCreate(name="X", cnic="42101-1234567-1", trade="Paint", phone="03001234567").phone == "03001234567"
    assert ContractorCreate(name="X", cnic="42101-1234567-1", trade="Paint", phone="").phone is None
