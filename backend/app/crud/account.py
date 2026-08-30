from sqlalchemy.orm import Session

from app.models.account import Account, AccountNature
from app.models.receipt import Receipt
from app.models.voucher import VoucherLine
from app.schemas.account import AccountCreate, AccountUpdate

_NATURE_PREFIX = {
    AccountNature.ASSET: 1,
    AccountNature.LIABILITY: 2,
    AccountNature.CAPITAL: 3,
    AccountNature.REVENUE: 4,
    AccountNature.EXPENSE: 5,
}


def _next_account_code(db: Session, nature: AccountNature) -> str:
    base = _NATURE_PREFIX[nature] * 1000
    existing = (
        db.query(Account.code).filter(Account.code.between(str(base), str(base + 999))).all()
    )
    max_code = base
    for (code,) in existing:
        if code.isdigit():
            max_code = max(max_code, int(code))
    return str(max_code + 1)


def list_accounts(db: Session, nature: str | None = None, is_active: bool | None = None) -> list[Account]:
    query = db.query(Account)
    if nature is not None:
        query = query.filter(Account.nature == nature)
    if is_active is not None:
        query = query.filter(Account.is_active == is_active)
    return query.order_by(Account.code).all()


def get_account(db: Session, account_id: int) -> Account | None:
    return db.query(Account).filter(Account.id == account_id).first()


def create_account(db: Session, account_in: AccountCreate) -> Account:
    db_account = Account(
        code=_next_account_code(db, account_in.nature),
        **account_in.model_dump(),
    )
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account


def update_account(db: Session, db_account: Account, account_in: AccountUpdate) -> Account:
    for field, value in account_in.model_dump(exclude_unset=True).items():
        setattr(db_account, field, value)
    db.commit()
    db.refresh(db_account)
    return db_account


def delete_account(db: Session, db_account: Account) -> None:
    children = db.query(Account).filter(Account.parent_id == db_account.id).all()
    if children:
        refs = ", ".join(c.name for c in children)
        raise ValueError(
            f"This account has {len(children)} sub-account(s) grouped under it: {refs}. "
            "Remove or re-group those first."
        )

    line_count = db.query(VoucherLine).filter(VoucherLine.account_id == db_account.id).count()
    receipt_count = db.query(Receipt).filter(Receipt.credit_account_id == db_account.id).count()
    if line_count or receipt_count:
        raise ValueError(
            f"This account has {line_count} voucher posting(s) and {receipt_count} receipt(s) "
            "against it and cannot be deleted."
        )

    db.delete(db_account)
    db.commit()


def account_balance(db: Session, account_id: int) -> float:
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return 0
    lines = db.query(VoucherLine).filter(VoucherLine.account_id == account_id).all()
    posted_debit = sum(float(line.debit) for line in lines)
    posted_credit = sum(float(line.credit) for line in lines)
    opening = float(account.opening_debit) - float(account.opening_credit)
    return opening + posted_debit - posted_credit
