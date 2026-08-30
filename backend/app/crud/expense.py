from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account
from app.models.expense import Employee, OfficeExpense, OwnerPersonalExpense, WagePayment
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.expense import (
    EmployeeCreate,
    EmployeeUpdate,
    OfficeExpenseCreate,
    OwnerPersonalExpenseCreate,
    WagePaymentCreate,
)

WAGES_ACCOUNT_CODE = "5020"
OWNER_PERSONAL_ACCOUNT_CODE = "5030"


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "PV-", 5)


def _get_account_by_code(db: Session, code: str) -> Account:
    account = db.query(Account).filter(Account.code == code).first()
    if not account:
        raise ValueError(f"Required account (code {code}) not found in chart of accounts")
    return account


# Office Expense


def _next_office_expense_no(db: Session) -> str:
    return next_sequence_number(db, OfficeExpense.expense_no, "OFE-", 5)


def list_office_expenses(db: Session, project_id: int | None = None) -> list[OfficeExpense]:
    query = db.query(OfficeExpense).options(
        joinedload(OfficeExpense.expense_head),
        joinedload(OfficeExpense.paid_from),
        joinedload(OfficeExpense.project),
    )
    if project_id is not None:
        query = query.filter(OfficeExpense.project_id == project_id)
    return query.order_by(OfficeExpense.id.desc()).all()


def get_office_expense(db: Session, expense_id: int) -> OfficeExpense | None:
    return (
        db.query(OfficeExpense)
        .options(
            joinedload(OfficeExpense.expense_head),
            joinedload(OfficeExpense.paid_from),
            joinedload(OfficeExpense.project),
        )
        .filter(OfficeExpense.id == expense_id)
        .first()
    )


def create_office_expense(db: Session, expense_in: OfficeExpenseCreate) -> OfficeExpense:
    db_expense = OfficeExpense(
        expense_no=_next_office_expense_no(db),
        **expense_in.model_dump(),
    )
    db.add(db_expense)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=expense_in.expense_date,
        project_id=expense_in.project_id,
        narration=f"Office expense {db_expense.expense_no}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=expense_in.expense_head_id,
            debit=expense_in.amount, credit=0, narration="Office expense",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=expense_in.paid_from_id,
            debit=0, credit=expense_in.amount, narration="Office expense paid",
        )
    )

    db_expense.voucher_id = voucher.id
    db.commit()
    return get_office_expense(db, db_expense.id)


def delete_office_expense(db: Session, db_expense: OfficeExpense) -> None:
    voucher_id = db_expense.voucher_id
    db.delete(db_expense)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()


# Employee


def _next_employee_code(db: Session) -> str:
    return next_sequence_number(db, Employee.employee_code, "EMP-", 5)


def list_employees(db: Session, is_active: bool | None = None) -> list[Employee]:
    query = db.query(Employee)
    if is_active is not None:
        query = query.filter(Employee.is_active == is_active)
    return query.order_by(Employee.id.desc()).all()


def get_employee(db: Session, employee_id: int) -> Employee | None:
    return db.query(Employee).filter(Employee.id == employee_id).first()


def create_employee(db: Session, employee_in: EmployeeCreate) -> Employee:
    db_employee = Employee(employee_code=_next_employee_code(db), **employee_in.model_dump())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee


def update_employee(db: Session, db_employee: Employee, employee_in: EmployeeUpdate) -> Employee:
    for field, value in employee_in.model_dump(exclude_unset=True).items():
        setattr(db_employee, field, value)
    db.commit()
    db.refresh(db_employee)
    return db_employee


def delete_employee(db: Session, db_employee: Employee) -> None:
    payments = db.query(WagePayment).filter(WagePayment.employee_id == db_employee.id).count()
    if payments:
        raise ValueError(
            f"This employee has {payments} wage payment(s) on record and cannot be deleted."
        )
    db.delete(db_employee)
    db.commit()


# Wage Payment


def _next_wage_payment_no(db: Session) -> str:
    return next_sequence_number(db, WagePayment.payment_no, "WGP-", 5)


def list_wage_payments(db: Session, employee_id: int | None = None) -> list[WagePayment]:
    query = db.query(WagePayment).options(
        joinedload(WagePayment.employee), joinedload(WagePayment.paid_from)
    )
    if employee_id is not None:
        query = query.filter(WagePayment.employee_id == employee_id)
    return query.order_by(WagePayment.id.desc()).all()


def get_wage_payment(db: Session, payment_id: int) -> WagePayment | None:
    return (
        db.query(WagePayment)
        .options(joinedload(WagePayment.employee), joinedload(WagePayment.paid_from))
        .filter(WagePayment.id == payment_id)
        .first()
    )


def create_wage_payment(db: Session, payment_in: WagePaymentCreate) -> WagePayment:
    net_paid = payment_in.gross_amount - payment_in.advances_deductions
    if net_paid <= 0:
        raise ValueError("Net paid amount must be greater than zero")

    wages_account = _get_account_by_code(db, WAGES_ACCOUNT_CODE)

    db_payment = WagePayment(
        payment_no=_next_wage_payment_no(db),
        net_paid=net_paid,
        **payment_in.model_dump(),
    )
    db.add(db_payment)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=payment_in.payment_date,
        narration=f"Wage payment {db_payment.payment_no}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=wages_account.id,
            debit=net_paid, credit=0, narration="Wage payment",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=payment_in.paid_from_id,
            debit=0, credit=net_paid, narration="Wage payment paid",
        )
    )

    db_payment.voucher_id = voucher.id
    db.commit()
    return get_wage_payment(db, db_payment.id)


def delete_wage_payment(db: Session, db_payment: WagePayment) -> None:
    voucher_id = db_payment.voucher_id
    db.delete(db_payment)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()


# Owner Personal Expense


def _next_owner_expense_no(db: Session) -> str:
    return next_sequence_number(db, OwnerPersonalExpense.expense_no, "OPE-", 5)


def list_owner_expenses(db: Session) -> list[OwnerPersonalExpense]:
    return (
        db.query(OwnerPersonalExpense)
        .options(joinedload(OwnerPersonalExpense.source_account))
        .order_by(OwnerPersonalExpense.id.desc())
        .all()
    )


def get_owner_expense(db: Session, expense_id: int) -> OwnerPersonalExpense | None:
    return (
        db.query(OwnerPersonalExpense)
        .options(joinedload(OwnerPersonalExpense.source_account))
        .filter(OwnerPersonalExpense.id == expense_id)
        .first()
    )


def create_owner_expense(db: Session, expense_in: OwnerPersonalExpenseCreate) -> OwnerPersonalExpense:
    owner_expense_account = _get_account_by_code(db, OWNER_PERSONAL_ACCOUNT_CODE)

    db_expense = OwnerPersonalExpense(
        expense_no=_next_owner_expense_no(db),
        **expense_in.model_dump(),
    )
    db.add(db_expense)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=expense_in.expense_date,
        narration=f"Owner personal expense {db_expense.expense_no} — {expense_in.category}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=owner_expense_account.id,
            debit=expense_in.amount, credit=0, narration=expense_in.category,
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=expense_in.source_account_id,
            debit=0, credit=expense_in.amount, narration=expense_in.category,
        )
    )

    db_expense.voucher_id = voucher.id
    db.commit()
    return get_owner_expense(db, db_expense.id)


def delete_owner_expense(db: Session, db_expense: OwnerPersonalExpense) -> None:
    voucher_id = db_expense.voucher_id
    db.delete(db_expense)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()
