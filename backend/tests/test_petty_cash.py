import pytest
from sqlalchemy.orm import Session

from app.crud import account as account_crud
from app.crud import petty_cash as petty_cash_crud
from app.models.account import Account, AccountNature
from app.models.voucher import Voucher
from app.schemas.petty_cash import (
    PettyCashExpenseCreate,
    PettyCashFloatCreate,
    PettyCashTopupCreate,
)
from tests.conftest import TODAY


@pytest.fixture()
def office_expense_account(db: Session) -> Account:
    obj = Account(code="5010", name="Office Expenses", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def float_(db: Session):
    return petty_cash_crud.create_float(db, PettyCashFloatCreate(holder_name="Site Supervisor", opening_balance=5_000))


def test_create_float_opens_with_starting_balance(db: Session, float_):
    assert account_crud.account_balance(db, float_.account_id) == 5_000


def test_topup_increases_float_balance_and_posts_balanced_voucher(
    db: Session, float_, cash_account
):
    topup = petty_cash_crud.create_topup(
        db,
        PettyCashTopupCreate(
            topup_date=TODAY, float_id=float_.id, amount=2_000, paid_from_id=cash_account.id
        ),
    )

    assert account_crud.account_balance(db, float_.account_id) == 7_000  # 5,000 + 2,000
    voucher = db.get(Voucher, topup.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 2_000


def test_delete_topup_removes_voucher_and_reverts_balance(db: Session, float_, cash_account):
    topup = petty_cash_crud.create_topup(
        db,
        PettyCashTopupCreate(
            topup_date=TODAY, float_id=float_.id, amount=2_000, paid_from_id=cash_account.id
        ),
    )
    voucher_id = topup.voucher_id

    petty_cash_crud.delete_topup(db, topup)

    assert db.get(Voucher, voucher_id) is None
    assert account_crud.account_balance(db, float_.account_id) == 5_000


def test_plain_expense_reduces_float_balance(db: Session, float_, office_expense_account):
    expense = petty_cash_crud.create_expense(
        db,
        PettyCashExpenseCreate(
            expense_date=TODAY, float_id=float_.id, description="Transport", amount=800
        ),
    )

    assert expense.amount == 800
    assert account_crud.account_balance(db, float_.account_id) == 4_200  # 5,000 - 800


def test_expense_posts_balanced_voucher(db: Session, float_, office_expense_account):
    expense = petty_cash_crud.create_expense(
        db,
        PettyCashExpenseCreate(
            expense_date=TODAY, float_id=float_.id, description="Transport", amount=800
        ),
    )

    voucher = db.get(Voucher, expense.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 800


def test_expense_requires_amount_when_not_a_material_purchase():
    with pytest.raises(ValueError, match="Amount is required"):
        PettyCashExpenseCreate(
            expense_date=TODAY, float_id=1, description="Transport"
        )


def test_delete_float_blocked_when_transactions_exist(
    db: Session, float_, office_expense_account
):
    petty_cash_crud.create_expense(
        db,
        PettyCashExpenseCreate(
            expense_date=TODAY, float_id=float_.id, description="Transport", amount=800
        ),
    )

    with pytest.raises(ValueError, match="cannot be deleted"):
        petty_cash_crud.delete_float(db, float_)


def test_delete_float_succeeds_when_untouched(db: Session, float_):
    account_id = float_.account_id
    petty_cash_crud.delete_float(db, float_)
    assert db.get(Account, account_id) is None
