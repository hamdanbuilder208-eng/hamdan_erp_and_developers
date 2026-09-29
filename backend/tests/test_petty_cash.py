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


# ---------------------------------------------------------------------------
# Office vs project: where a plain petty cash spend is booked
# ---------------------------------------------------------------------------

def _debit_account(db: Session, expense) -> Account:
    voucher = db.get(Voucher, expense.voucher_id)
    return next(l.account for l in voucher.lines if l.debit > 0)


def test_office_spend_is_booked_as_office_expense(db: Session, float_, office_expense_account):
    expense = petty_cash_crud.create_expense(
        db,
        PettyCashExpenseCreate(expense_date=TODAY, float_id=float_.id, description="Tea & stationery", amount=800),
    )
    assert _debit_account(db, expense).code == "5010"
    assert db.get(Voucher, expense.voucher_id).project_id is None
    assert [e.id for e in petty_cash_crud.list_expenses(db, office_only=True)] == [expense.id]


def test_project_spend_is_booked_to_that_project_not_office(
    db: Session, float_, office_expense_account, project
):
    from app.crud import partner as partner_crud
    from app.crud import project as project_crud

    expense = petty_cash_crud.create_expense(
        db,
        PettyCashExpenseCreate(
            expense_date=TODAY, float_id=float_.id, description="Labour transport", amount=1_500,
            project_id=project.id,
        ),
    )
    debit = _debit_account(db, expense)
    assert debit.code == "5070" and debit.name == "Project Site Expenses"
    assert db.get(Voucher, expense.voucher_id).project_id == project.id
    # Shows up as that project's spend/cost, and not in the office list.
    assert project_crud.project_total_spent(db, project.id) == 1_500
    assert partner_crud.compute_project_profit(db, project.id) == (0, 1_500)
    assert petty_cash_crud.list_expenses(db, office_only=True) == []


def test_site_material_needs_a_project_or_warehouse():
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="needs a project"):
        PettyCashExpenseCreate(
            expense_date=TODAY, float_id=1, description="Cement", material_id=1, quantity=10, rate=1_200
        )
