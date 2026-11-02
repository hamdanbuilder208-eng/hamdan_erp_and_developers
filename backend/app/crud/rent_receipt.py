from datetime import date

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.payment_details import apply_payment_details
from app.core.sequences import next_sequence_number
from app.models.account import Account, AccountNature
from app.models.receipt import ChequeStatus
from app.models.rental import (
    RentAgreement,
    RentReceipt,
    RentReceiptAllocation,
    RentReceiptType,
    RentScheduleLine,
)
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.rental import RentReceiptCreate

RENT_INCOME_ACCOUNT_CODE = "4030"
SECURITY_DEPOSIT_ACCOUNT_CODE = "2040"


def _get_or_create_deposit_account(db: Session) -> Account:
    """Tenants' security deposits are owed back to them — a liability."""
    account = db.query(Account).filter(Account.code == SECURITY_DEPOSIT_ACCOUNT_CODE).first()
    if account:
        return account
    liabilities = db.query(Account).filter(Account.code == "2000").first()
    account = Account(
        code=SECURITY_DEPOSIT_ACCOUNT_CODE,
        name="Security Deposits (Tenants)",
        nature=AccountNature.LIABILITY,
        parent_id=liabilities.id if liabilities else None,
    )
    db.add(account)
    db.flush()
    return account


def _next_receipt_no(db: Session) -> str:
    return next_sequence_number(db, RentReceipt.receipt_no, "RNC-", 5)


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "RV-", 5)


def _load_query(db: Session):
    return db.query(RentReceipt).options(
        joinedload(RentReceipt.credit_account),
        joinedload(RentReceipt.agreement).joinedload(RentAgreement.schedule_lines),
        joinedload(RentReceipt.agreement).joinedload(RentAgreement.tenant),
        joinedload(RentReceipt.agreement).joinedload(RentAgreement.unit),
        joinedload(RentReceipt.agreement).joinedload(RentAgreement.land_property),
    )


def list_receipts(db: Session, agreement_id: int | None = None) -> list[RentReceipt]:
    query = _load_query(db)
    if agreement_id is not None:
        query = query.filter(RentReceipt.agreement_id == agreement_id)
    return query.order_by(RentReceipt.id.desc()).all()


def get_receipt(db: Session, receipt_id: int) -> RentReceipt | None:
    return _load_query(db).filter(RentReceipt.id == receipt_id).first()


def line_paid_as_of(db: Session, db_receipt: RentReceipt) -> dict[int, float]:
    """Same as receipt.line_paid_as_of, for an agreement's rent receipts."""
    rows = (
        db.query(RentReceiptAllocation.schedule_line_id, func.sum(RentReceiptAllocation.amount))
        .join(RentReceipt, RentReceiptAllocation.rent_receipt_id == RentReceipt.id)
        .filter(
            RentReceipt.agreement_id == db_receipt.agreement_id,
            or_(
                RentReceipt.receipt_date < db_receipt.receipt_date,
                and_(
                    RentReceipt.receipt_date == db_receipt.receipt_date,
                    RentReceipt.id <= db_receipt.id,
                ),
            ),
        )
        .group_by(RentReceiptAllocation.schedule_line_id)
        .all()
    )
    return {line_id: float(total) for line_id, total in rows}


def _distribute_amount(db: Session, agreement: RentAgreement, receipt_id: int, amount: float) -> None:
    remaining = amount
    lines = sorted(agreement.schedule_lines, key=lambda l: l.month_no)
    for line in lines:
        if remaining <= 0:
            break
        due = float(line.amount) - float(line.paid_amount)
        if due <= 0:
            continue
        applied = min(due, remaining)
        line.paid_amount = float(line.paid_amount) + applied
        remaining -= applied
        db.add(
            RentReceiptAllocation(rent_receipt_id=receipt_id, schedule_line_id=line.id, amount=applied)
        )


def _reverse_allocations(db: Session, db_receipt: RentReceipt) -> None:
    allocations = (
        db.query(RentReceiptAllocation)
        .filter(RentReceiptAllocation.rent_receipt_id == db_receipt.id)
        .all()
    )
    for allocation in allocations:
        line = (
            db.query(RentScheduleLine)
            .filter(RentScheduleLine.id == allocation.schedule_line_id)
            .first()
        )
        if line:
            line.paid_amount = float(line.paid_amount) - float(allocation.amount)
        db.delete(allocation)


def _apply_ledger(db: Session, agreement: RentAgreement, db_receipt: RentReceipt) -> None:
    """Books the receipt: a Receipt voucher (debit where the money went;
    credit Rental Income, or the tenants' Security Deposits liability for a
    deposit) and, for rent, settles the oldest unpaid months. Used on creation
    and again when a bounced cheque is re-presented and clears."""
    is_deposit = db_receipt.receipt_type == RentReceiptType.SECURITY_DEPOSIT
    if is_deposit:
        credit_account = _get_or_create_deposit_account(db)
        what = "Security deposit"
    else:
        credit_account = db.query(Account).filter(Account.code == RENT_INCOME_ACCOUNT_CODE).first()
        if not credit_account:
            raise ValueError(
                f"Rental Income account (code {RENT_INCOME_ACCOUNT_CODE}) not found in chart of accounts"
            )
        what = "Rent"

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.RECEIPT,
        voucher_date=db_receipt.receipt_date,
        # Rent on a project's unit/shop is that project's income (its P&L and
        # partners' profit); rent on a Land & Plots property goes to that property.
        project_id=agreement.unit.project_id if agreement.unit else None,
        land_property_id=agreement.land_property_id,
        narration=f"{what} receipt {db_receipt.receipt_no} — {agreement.agreement_no}",
    )
    db.add(voucher)
    db.flush()
    for account_id, debit, credit in (
        (db_receipt.credit_account_id, db_receipt.amount, 0),
        (credit_account.id, 0, db_receipt.amount),
    ):
        db.add(
            VoucherLine(
                voucher_id=voucher.id,
                account_id=account_id,
                debit=debit,
                credit=credit,
                narration=f"{what} received against {agreement.agreement_no}",
            )
        )

    db_receipt.voucher_id = voucher.id
    db.flush()
    if not is_deposit:
        _distribute_amount(db, agreement, db_receipt.id, float(db_receipt.amount))


def _unapply_ledger(db: Session, db_receipt: RentReceipt) -> None:
    _reverse_allocations(db, db_receipt)
    voucher_id = db_receipt.voucher_id
    db_receipt.voucher_id = None
    db.flush()
    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)
            db.flush()


def create_receipt(db: Session, receipt_in: RentReceiptCreate) -> RentReceipt:
    agreement = (
        db.query(RentAgreement).filter(RentAgreement.id == receipt_in.agreement_id).first()
    )
    if not agreement:
        raise ValueError("Rent agreement not found")

    is_cheque = receipt_in.mode_of_payment == "Cheque"
    db_receipt = RentReceipt(
        receipt_no=_next_receipt_no(db),
        receipt_date=receipt_in.receipt_date,
        receipt_type=receipt_in.receipt_type,
        agreement_id=receipt_in.agreement_id,
        credit_account_id=receipt_in.credit_account_id,
        amount=receipt_in.amount,
        mode_of_payment=receipt_in.mode_of_payment,
        cheque_date=receipt_in.cheque_date if is_cheque else None,
        cheque_clearing_date=receipt_in.cheque_clearing_date if is_cheque else None,
        cheque_status=ChequeStatus.PENDING if is_cheque else None,
        narration=receipt_in.narration,
    )
    apply_payment_details(db_receipt, receipt_in.mode_of_payment, receipt_in.model_dump())
    db.add(db_receipt)
    db.flush()

    _apply_ledger(db, agreement, db_receipt)

    db.commit()
    return get_receipt(db, db_receipt.id)


def list_pending_cheques(db: Session, due_by: date | None = None) -> list[RentReceipt]:
    """Rent / deposit cheques not yet confirmed — for the dashboard reminder."""
    query = _load_query(db).filter(RentReceipt.cheque_status == ChequeStatus.PENDING)
    if due_by is not None:
        # No cash date recorded: always remind, there's no telling when it's due.
        query = query.filter(
            or_(RentReceipt.cheque_clearing_date <= due_by, RentReceipt.cheque_clearing_date.is_(None))
        )
    return query.order_by(RentReceipt.cheque_clearing_date.asc()).all()


def mark_cheque_status(db: Session, db_receipt: RentReceipt, new_status: ChequeStatus) -> RentReceipt:
    """Same rules as a booking receipt's cheque: the books always match the
    status — applied unless Bounced. A bounce undoes the rent/deposit entry;
    a bounced cheque re-presented and cleared books it again."""
    if db_receipt.mode_of_payment != "Cheque":
        raise ValueError("This receipt was not paid by cheque")
    if db_receipt.cheque_status == new_status:
        raise ValueError(f"This cheque is already marked {new_status.value}")
    if new_status not in (ChequeStatus.CLEARED, ChequeStatus.BOUNCED):
        raise ValueError("Status must be Cleared or Bounced")

    was_applied = db_receipt.cheque_status != ChequeStatus.BOUNCED
    if was_applied and new_status == ChequeStatus.BOUNCED:
        _unapply_ledger(db, db_receipt)
    elif not was_applied and new_status == ChequeStatus.CLEARED:
        agreement = db.query(RentAgreement).filter(RentAgreement.id == db_receipt.agreement_id).first()
        _apply_ledger(db, agreement, db_receipt)

    db_receipt.cheque_status = new_status
    db.commit()
    return get_receipt(db, db_receipt.id)


def delete_receipt(db: Session, db_receipt: RentReceipt) -> None:
    _reverse_allocations(db, db_receipt)

    voucher_id = db_receipt.voucher_id
    db.delete(db_receipt)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()
