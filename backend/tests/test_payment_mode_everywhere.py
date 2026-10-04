import pytest
from sqlalchemy.orm import Session

from app.crud import expense as expense_crud
from app.crud import petty_cash as petty_cash_crud
from app.models.account import Account, AccountNature
from app.schemas.expense import OfficeExpenseCreate, OfficeExpenseOut
from app.schemas.petty_cash import PettyCashFloatCreate, PettyCashTopupCreate
from tests.conftest import TODAY


@pytest.fixture()
def expense_head(db: Session) -> Account:
    obj = Account(code="5011", name="Stationery", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    return obj


def test_cheque_expense_saves_cheque_details(db: Session, expense_head, cash_account):
    expense = expense_crud.create_office_expense(
        db,
        OfficeExpenseCreate(
            expense_date=TODAY, expense_head_id=expense_head.id, paid_from_id=cash_account.id, amount=5_000,
            mode_of_payment="Cheque", cheque_no="000123", cheque_bank_name="HBL",
            # transfer fields don't belong to a cheque and are dropped
            transfer_account_no="999",
        ),
    )
    out = OfficeExpenseOut.model_validate(expense)
    assert (out.mode_of_payment, out.cheque_no, out.cheque_bank_name) == ("Cheque", "000123", "HBL")
    assert out.transfer_account_no is None


def test_cheque_without_number_is_rejected(db: Session, expense_head, cash_account):
    with pytest.raises(ValueError, match="cheque number"):
        expense_crud.create_office_expense(
            db,
            OfficeExpenseCreate(
                expense_date=TODAY, expense_head_id=expense_head.id, paid_from_id=cash_account.id,
                amount=5_000, mode_of_payment="Cheque",
            ),
        )


def test_bank_transfer_topup_needs_both_accounts(db: Session, cash_account):
    float_ = petty_cash_crud.create_float(db, PettyCashFloatCreate(holder_name="Site"))
    base = dict(topup_date=TODAY, float_id=float_.id, amount=1_000, paid_from_id=cash_account.id)
    with pytest.raises(ValueError, match="receiver's account"):
        petty_cash_crud.create_topup(
            db,
            PettyCashTopupCreate(
                **base, mode_of_payment="Bank Transfer",
                transfer_account_title="Hamdan Builders", transfer_account_no="0101",
            ),
        )
    db.rollback()
    topup = petty_cash_crud.create_topup(
        db,
        PettyCashTopupCreate(
            **base, mode_of_payment="Bank Transfer",
            transfer_account_title="Hamdan Builders", transfer_account_no="0101",
            transfer_to_account_title="Site", transfer_to_account_no="0202",
        ),
    )
    assert topup.mode_of_payment == "Bank Transfer"
    assert topup.transfer_to_account_no == "0202"


def test_cash_is_the_default(db: Session, expense_head, cash_account):
    expense = expense_crud.create_office_expense(
        db,
        OfficeExpenseCreate(
            expense_date=TODAY, expense_head_id=expense_head.id, paid_from_id=cash_account.id, amount=100,
        ),
    )
    assert expense.mode_of_payment == "Cash"
    assert expense.cheque_no is None
