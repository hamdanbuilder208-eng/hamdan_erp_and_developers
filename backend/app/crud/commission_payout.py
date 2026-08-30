from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.crud.booking_agent import _commission_row
from app.models.account import Account, AccountNature
from app.models.booking import Booking
from app.models.commission_payout import CommissionPayout
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.commission_payout import CommissionPayoutCreate

COMMISSION_EXPENSE_CODE = "5040"


def _next_payout_no(db: Session) -> str:
    return next_sequence_number(db, CommissionPayout.payout_no, "COM-", 5)


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "PV-", 5)


def _get_or_create_commission_expense_account(db: Session) -> Account:
    account = db.query(Account).filter(Account.code == COMMISSION_EXPENSE_CODE).first()
    if account:
        return account
    expenses_group = db.query(Account).filter(Account.code == "5000").first()
    account = Account(
        code=COMMISSION_EXPENSE_CODE,
        name="Commission Expense",
        nature=AccountNature.EXPENSE,
        parent_id=expenses_group.id if expenses_group else None,
    )
    db.add(account)
    db.flush()
    return account


def _load_query(db: Session):
    return db.query(CommissionPayout).options(
        joinedload(CommissionPayout.agent),
        joinedload(CommissionPayout.credit_account),
        joinedload(CommissionPayout.booking).joinedload(Booking.project),
        joinedload(CommissionPayout.booking).joinedload(Booking.unit),
        joinedload(CommissionPayout.booking).joinedload(Booking.allottee),
    )


def list_payouts(db: Session, agent_id: int | None = None, booking_id: int | None = None):
    query = _load_query(db)
    if agent_id is not None:
        query = query.filter(CommissionPayout.agent_id == agent_id)
    if booking_id is not None:
        query = query.filter(CommissionPayout.booking_id == booking_id)
    return query.order_by(CommissionPayout.id.desc()).all()


def get_payout(db: Session, payout_id: int) -> CommissionPayout | None:
    return _load_query(db).filter(CommissionPayout.id == payout_id).first()


def create_payout(db: Session, payout_in: CommissionPayoutCreate) -> CommissionPayout:
    booking = (
        db.query(Booking)
        .options(
            joinedload(Booking.unit),
            joinedload(Booking.allottee),
            joinedload(Booking.schedule_lines),
        )
        .filter(Booking.id == payout_in.booking_id)
        .first()
    )
    if not booking:
        raise ValueError("Booking not found")
    if booking.booking_agent_id != payout_in.agent_id:
        raise ValueError("This agent is not linked to the selected booking")

    row = _commission_row(db, booking)
    if payout_in.amount > row.commission_balance + 0.01:
        raise ValueError(
            f"Payout exceeds the commission balance. Eligible balance is "
            f"PKR {row.commission_balance:,.2f}"
        )

    expense_account = _get_or_create_commission_expense_account(db)

    db_payout = CommissionPayout(
        payout_no=_next_payout_no(db),
        payout_date=payout_in.payout_date,
        booking_id=payout_in.booking_id,
        agent_id=payout_in.agent_id,
        credit_account_id=payout_in.credit_account_id,
        amount=payout_in.amount,
        narration=payout_in.narration,
    )
    db.add(db_payout)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=payout_in.payout_date,
        project_id=booking.project_id,
        narration=f"Commission payout {db_payout.payout_no} — {booking.booking_ref_no}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=expense_account.id,
            debit=payout_in.amount,
            credit=0,
            narration=f"Commission for {booking.booking_ref_no}",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=payout_in.credit_account_id,
            debit=0,
            credit=payout_in.amount,
            narration=f"Commission paid for {booking.booking_ref_no}",
        )
    )

    db_payout.voucher_id = voucher.id
    db.commit()
    return get_payout(db, db_payout.id)


def delete_payout(db: Session, db_payout: CommissionPayout) -> None:
    voucher_id = db_payout.voucher_id
    db.delete(db_payout)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()
