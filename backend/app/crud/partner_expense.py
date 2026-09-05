from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account
from app.models.partner import PartnerExpense
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.partner import PartnerExpenseCreate

PARTNER_PAYABLE_ACCOUNT_CODE = "2030"


def _next_expense_no(db: Session) -> str:
    return next_sequence_number(db, PartnerExpense.expense_no, "PEX-", 5)


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "JV-", 5)


def _load_query(db: Session):
    return db.query(PartnerExpense).options(
        joinedload(PartnerExpense.partner),
        joinedload(PartnerExpense.expense_account),
    )


def list_expenses(db: Session, partner_id: int | None = None, project_id: int | None = None):
    query = _load_query(db)
    if partner_id is not None:
        query = query.filter(PartnerExpense.partner_id == partner_id)
    if project_id is not None:
        query = query.filter(PartnerExpense.project_id == project_id)
    return query.order_by(PartnerExpense.id.desc()).all()


def get_expense(db: Session, expense_id: int) -> PartnerExpense | None:
    return _load_query(db).filter(PartnerExpense.id == expense_id).first()


def create_expense(db: Session, expense_in: PartnerExpenseCreate) -> PartnerExpense:
    payable_account = db.query(Account).filter(Account.code == PARTNER_PAYABLE_ACCOUNT_CODE).first()
    if not payable_account:
        raise ValueError(
            f"Partner Payable account (code {PARTNER_PAYABLE_ACCOUNT_CODE}) not found in chart of accounts"
        )

    db_expense = PartnerExpense(
        expense_no=_next_expense_no(db),
        expense_date=expense_in.expense_date,
        partner_id=expense_in.partner_id,
        project_id=expense_in.project_id,
        expense_account_id=expense_in.expense_account_id,
        amount=expense_in.amount,
        narration=expense_in.narration,
    )
    db.add(db_expense)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.JOURNAL,
        voucher_date=expense_in.expense_date,
        project_id=expense_in.project_id,
        narration=f"Partner expense {db_expense.expense_no} — paid on company's behalf",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=expense_in.expense_account_id,
            debit=expense_in.amount,
            credit=0,
            narration="Paid on partner's behalf",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=payable_account.id,
            debit=0,
            credit=expense_in.amount,
            narration="Amount owed back to partner",
        )
    )

    db_expense.voucher_id = voucher.id
    db.commit()
    return get_expense(db, db_expense.id)


def delete_expense(db: Session, db_expense: PartnerExpense) -> None:
    voucher_id = db_expense.voucher_id
    db.delete(db_expense)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()
