import pytest
from sqlalchemy.orm import Session

from app.crud import expense as expense_crud
from app.models.account import Account, AccountNature
from app.models.expense import Employee, WageType
from app.models.voucher import Voucher
from app.schemas.expense import (
    EmployeeCreate,
    OfficeExpenseCreate,
    OwnerPersonalExpenseCreate,
    WagePaymentCreate,
)
from tests.conftest import TODAY


@pytest.fixture()
def expense_head(db: Session) -> Account:
    obj = Account(code="5015", name="Utilities", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def wages_account(db: Session) -> Account:
    obj = Account(code="5020", name="Wages", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def owner_personal_account(db: Session) -> Account:
    obj = Account(code="5030", name="Owner Personal", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def employee(db: Session) -> Employee:
    return expense_crud.create_employee(
        db, EmployeeCreate(name="Site Worker", wage_type=WageType.MONTHLY, rate=30_000)
    )


def test_create_office_expense_posts_balanced_voucher(
    db: Session, expense_head, cash_account
):
    result = expense_crud.create_office_expense(
        db,
        OfficeExpenseCreate(
            expense_date=TODAY,
            expense_head_id=expense_head.id,
            paid_from_id=cash_account.id,
            amount=5_000,
        ),
    )

    voucher = db.get(Voucher, result.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 5_000


def test_delete_office_expense_removes_voucher(db: Session, expense_head, cash_account):
    result = expense_crud.create_office_expense(
        db,
        OfficeExpenseCreate(
            expense_date=TODAY,
            expense_head_id=expense_head.id,
            paid_from_id=cash_account.id,
            amount=5_000,
        ),
    )
    voucher_id = result.voucher_id

    expense_crud.delete_office_expense(db, result)

    assert db.get(Voucher, voucher_id) is None


def test_delete_employee_blocked_when_wage_payments_exist(
    db: Session, employee, wages_account, cash_account
):
    expense_crud.create_wage_payment(
        db,
        WagePaymentCreate(
            payment_date=TODAY,
            employee_id=employee.id,
            period_from=TODAY,
            period_to=TODAY,
            gross_amount=30_000,
            paid_from_id=cash_account.id,
        ),
    )

    with pytest.raises(ValueError, match="cannot be deleted"):
        expense_crud.delete_employee(db, employee)


def test_wage_payment_nets_advances_against_gross(db: Session, employee, wages_account, cash_account):
    payment = expense_crud.create_wage_payment(
        db,
        WagePaymentCreate(
            payment_date=TODAY,
            employee_id=employee.id,
            period_from=TODAY,
            period_to=TODAY,
            gross_amount=30_000,
            advances_deductions=5_000,
            paid_from_id=cash_account.id,
        ),
    )

    assert payment.net_paid == 25_000
    voucher = db.get(Voucher, payment.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 25_000


def test_wage_payment_rejects_when_advances_consume_entire_gross(
    db: Session, employee, wages_account, cash_account
):
    with pytest.raises(ValueError, match="greater than zero"):
        expense_crud.create_wage_payment(
            db,
            WagePaymentCreate(
                payment_date=TODAY,
                employee_id=employee.id,
                period_from=TODAY,
                period_to=TODAY,
                gross_amount=10_000,
                advances_deductions=10_000,
                paid_from_id=cash_account.id,
            ),
        )


def test_owner_personal_expense_posts_balanced_voucher(
    db: Session, owner_personal_account, cash_account
):
    result = expense_crud.create_owner_expense(
        db,
        OwnerPersonalExpenseCreate(
            expense_date=TODAY,
            category="Personal Travel",
            source_account_id=cash_account.id,
            amount=15_000,
        ),
    )

    voucher = db.get(Voucher, result.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 15_000


def test_owner_personal_expense_requires_account_in_chart(db: Session, cash_account):
    with pytest.raises(ValueError, match="not found in chart of accounts"):
        expense_crud.create_owner_expense(
            db,
            OwnerPersonalExpenseCreate(
                expense_date=TODAY,
                category="Personal Travel",
                source_account_id=cash_account.id,
                amount=15_000,
            ),
        )
