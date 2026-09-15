from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.crud.account import _next_account_code
from app.crud.account import account_balance
from app.crud.inventory import _assert_latest_movement, _post_stock_movement
from app.models.account import Account, AccountNature
from app.models.inventory import StockLedger, StockMovementType, StockRefType
from app.models.petty_cash import PettyCashExpense, PettyCashFloat, PettyCashTopup
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.petty_cash import (
    PettyCashExpenseCreate,
    PettyCashFloatCreate,
    PettyCashFloatUpdate,
    PettyCashTopupCreate,
)

PETTY_CASH_GROUP_NAME = "Petty Cash"
MATERIAL_STOCK_ACCOUNT_CODE = "1040"
DEFAULT_PETTY_CASH_EXPENSE_ACCOUNT_CODE = "5010"  # Office Expenses — the catch-all for a plain spend


def _attach_balance(db: Session, account: Account | None) -> None:
    # AccountWithBalance.balance isn't a DB column — it has to be computed
    # and stuck onto the ORM object before Pydantic reads it via from_attributes.
    if account is not None:
        account.balance = account_balance(db, account.id)


def _next_journal_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "JV-", 5)


def _get_account_by_code(db: Session, code: str) -> Account:
    account = db.query(Account).filter(Account.code == code).first()
    if not account:
        raise ValueError(f"Required account (code {code}) not found in chart of accounts")
    return account


def _get_or_create_petty_cash_group(db: Session) -> Account:
    group = (
        db.query(Account)
        .filter(Account.name == PETTY_CASH_GROUP_NAME, Account.nature == AccountNature.ASSET)
        .first()
    )
    if group:
        return group
    group = Account(
        code=_next_account_code(db, AccountNature.ASSET),
        name=PETTY_CASH_GROUP_NAME,
        nature=AccountNature.ASSET,
        is_control=True,
    )
    db.add(group)
    db.flush()
    return group


# Float


def _load_float_query(db: Session):
    return db.query(PettyCashFloat).options(joinedload(PettyCashFloat.account))


def list_floats(db: Session, is_active: bool | None = None) -> list[PettyCashFloat]:
    query = _load_float_query(db)
    if is_active is not None:
        query = query.filter(PettyCashFloat.is_active == is_active)
    floats = query.order_by(PettyCashFloat.id.desc()).all()
    for f in floats:
        _attach_balance(db, f.account)
    return floats


def get_float(db: Session, float_id: int) -> PettyCashFloat | None:
    db_float = _load_float_query(db).filter(PettyCashFloat.id == float_id).first()
    if db_float:
        _attach_balance(db, db_float.account)
    return db_float


def create_float(db: Session, float_in: PettyCashFloatCreate) -> PettyCashFloat:
    group = _get_or_create_petty_cash_group(db)
    account = Account(
        code=_next_account_code(db, AccountNature.ASSET),
        name=f"Petty Cash - {float_in.holder_name}",
        nature=AccountNature.ASSET,
        parent_id=group.id,
        opening_debit=float_in.opening_balance,
    )
    db.add(account)
    db.flush()

    db_float = PettyCashFloat(
        float_code=next_sequence_number(db, PettyCashFloat.float_code, "PCF-", 5),
        holder_name=float_in.holder_name,
        account_id=account.id,
    )
    db.add(db_float)
    db.commit()
    return get_float(db, db_float.id)


def update_float(db: Session, db_float: PettyCashFloat, float_in: PettyCashFloatUpdate) -> PettyCashFloat:
    account = db.query(Account).filter(Account.id == db_float.account_id).first()

    if float_in.holder_name is not None:
        db_float.holder_name = float_in.holder_name
        if account:
            account.name = f"Petty Cash - {float_in.holder_name}"

    if float_in.balance is not None and account:
        current_balance = account_balance(db, account.id)
        delta = float_in.balance - current_balance
        account.opening_debit = float(account.opening_debit) + delta

    db.commit()
    return get_float(db, db_float.id)


def delete_float(db: Session, db_float: PettyCashFloat) -> None:
    topup_count = db.query(PettyCashTopup).filter(PettyCashTopup.float_id == db_float.id).count()
    expense_count = db.query(PettyCashExpense).filter(PettyCashExpense.float_id == db_float.id).count()
    if topup_count or expense_count:
        raise ValueError(
            f"This float has {topup_count} top-up(s) and {expense_count} expense(s) recorded "
            "against it and cannot be deleted. Mark it inactive instead."
        )
    account_id = db_float.account_id
    db.delete(db_float)
    db.flush()
    account = db.query(Account).filter(Account.id == account_id).first()
    if account:
        db.delete(account)
    db.commit()


# Top-up


def _load_topup_query(db: Session):
    return db.query(PettyCashTopup).options(
        joinedload(PettyCashTopup.float).joinedload(PettyCashFloat.account),
        joinedload(PettyCashTopup.paid_from),
    )


def list_topups(db: Session, float_id: int | None = None) -> list[PettyCashTopup]:
    query = _load_topup_query(db)
    if float_id is not None:
        query = query.filter(PettyCashTopup.float_id == float_id)
    topups = query.order_by(PettyCashTopup.id.desc()).all()
    for t in topups:
        _attach_balance(db, t.float.account)
        _attach_balance(db, t.paid_from)
    return topups


def create_topup(db: Session, topup_in: PettyCashTopupCreate) -> PettyCashTopup:
    db_float = db.query(PettyCashFloat).filter(PettyCashFloat.id == topup_in.float_id).first()
    if not db_float:
        raise ValueError("Float not found")

    db_topup = PettyCashTopup(
        topup_no=next_sequence_number(db, PettyCashTopup.topup_no, "PCT-", 5),
        topup_date=topup_in.topup_date,
        float_id=topup_in.float_id,
        amount=topup_in.amount,
        paid_from_id=topup_in.paid_from_id,
        narration=topup_in.narration,
    )
    db.add(db_topup)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_journal_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=topup_in.topup_date,
        narration=f"Petty cash top-up {db_topup.topup_no} — {db_float.holder_name}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=db_float.account_id,
            debit=topup_in.amount, credit=0, narration="Petty cash top-up",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=topup_in.paid_from_id,
            debit=0, credit=topup_in.amount, narration="Petty cash top-up",
        )
    )

    db_topup.voucher_id = voucher.id
    db.commit()
    return get_topup(db, db_topup.id)


def get_topup(db: Session, topup_id: int) -> PettyCashTopup | None:
    db_topup = _load_topup_query(db).filter(PettyCashTopup.id == topup_id).first()
    if db_topup:
        _attach_balance(db, db_topup.float.account)
        _attach_balance(db, db_topup.paid_from)
    return db_topup


def delete_topup(db: Session, db_topup: PettyCashTopup) -> None:
    voucher_id = db_topup.voucher_id
    db.delete(db_topup)
    db.flush()
    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)
    db.commit()


# Expense


def _load_expense_query(db: Session):
    return db.query(PettyCashExpense).options(
        joinedload(PettyCashExpense.float).joinedload(PettyCashFloat.account),
        joinedload(PettyCashExpense.project),
        joinedload(PettyCashExpense.material),
        joinedload(PettyCashExpense.warehouse),
    )


def list_expenses(
    db: Session, float_id: int | None = None, project_id: int | None = None
) -> list[PettyCashExpense]:
    query = _load_expense_query(db)
    if float_id is not None:
        query = query.filter(PettyCashExpense.float_id == float_id)
    if project_id is not None:
        query = query.filter(PettyCashExpense.project_id == project_id)
    expenses = query.order_by(PettyCashExpense.id.desc()).all()
    for e in expenses:
        _attach_balance(db, e.float.account)
    return expenses


def get_expense(db: Session, expense_id: int) -> PettyCashExpense | None:
    db_expense = _load_expense_query(db).filter(PettyCashExpense.id == expense_id).first()
    if db_expense:
        _attach_balance(db, db_expense.float.account)
    return db_expense


def create_expense(db: Session, expense_in: PettyCashExpenseCreate) -> PettyCashExpense:
    db_float = db.query(PettyCashFloat).filter(PettyCashFloat.id == expense_in.float_id).first()
    if not db_float:
        raise ValueError("Float not found")

    is_material = expense_in.material_id is not None
    amount = round(expense_in.quantity * expense_in.rate, 2) if is_material else expense_in.amount

    db_expense = PettyCashExpense(
        expense_no=next_sequence_number(db, PettyCashExpense.expense_no, "PCE-", 5),
        expense_date=expense_in.expense_date,
        float_id=expense_in.float_id,
        description=expense_in.description,
        amount=amount,
        project_id=expense_in.project_id,
        material_id=expense_in.material_id,
        quantity=expense_in.quantity,
        warehouse_id=expense_in.warehouse_id,
    )
    db.add(db_expense)
    db.flush()

    if is_material:
        _post_stock_movement(
            db,
            material_id=expense_in.material_id,
            warehouse_id=expense_in.warehouse_id,
            project_id=expense_in.project_id,
            movement_date=expense_in.expense_date,
            movement_type=StockMovementType.IN,
            ref_type=StockRefType.PETTY_CASH,
            ref_id=db_expense.id,
            quantity=expense_in.quantity,
            rate=expense_in.rate,
        )
        debit_account = _get_account_by_code(db, MATERIAL_STOCK_ACCOUNT_CODE)
    else:
        debit_account = _get_account_by_code(db, DEFAULT_PETTY_CASH_EXPENSE_ACCOUNT_CODE)

    voucher = Voucher(
        voucher_no=_next_journal_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=expense_in.expense_date,
        project_id=expense_in.project_id,
        narration=f"Petty cash expense {db_expense.expense_no} — {db_float.holder_name}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=debit_account.id,
            debit=amount, credit=0, narration=expense_in.description,
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id, account_id=db_float.account_id,
            debit=0, credit=amount, narration=expense_in.description,
        )
    )

    db_expense.voucher_id = voucher.id
    db.commit()
    return get_expense(db, db_expense.id)


def delete_expense(db: Session, db_expense: PettyCashExpense) -> None:
    if db_expense.material_id is not None:
        _assert_latest_movement(
            db,
            db_expense.material_id,
            db_expense.warehouse_id,
            StockRefType.PETTY_CASH,
            db_expense.id,
            f"Petty cash expense {db_expense.expense_no}",
            project_id=db_expense.project_id if db_expense.warehouse_id is None else None,
        )
        db.query(StockLedger).filter(
            StockLedger.ref_type == StockRefType.PETTY_CASH, StockLedger.ref_id == db_expense.id
        ).delete()

    voucher_id = db_expense.voucher_id
    db.delete(db_expense)
    db.flush()
    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)
    db.commit()
