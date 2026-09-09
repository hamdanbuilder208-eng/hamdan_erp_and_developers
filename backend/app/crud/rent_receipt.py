from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account
from app.models.rental import RentAgreement, RentReceipt, RentReceiptAllocation, RentScheduleLine
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.rental import RentReceiptCreate

RENT_INCOME_ACCOUNT_CODE = "4030"


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


def create_receipt(db: Session, receipt_in: RentReceiptCreate) -> RentReceipt:
    agreement = (
        db.query(RentAgreement).filter(RentAgreement.id == receipt_in.agreement_id).first()
    )
    if not agreement:
        raise ValueError("Rent agreement not found")

    rent_income_account = db.query(Account).filter(Account.code == RENT_INCOME_ACCOUNT_CODE).first()
    if not rent_income_account:
        raise ValueError(
            f"Rental Income account (code {RENT_INCOME_ACCOUNT_CODE}) not found in chart of accounts"
        )

    db_receipt = RentReceipt(
        receipt_no=_next_receipt_no(db),
        receipt_date=receipt_in.receipt_date,
        agreement_id=receipt_in.agreement_id,
        credit_account_id=receipt_in.credit_account_id,
        amount=receipt_in.amount,
        mode_of_payment=receipt_in.mode_of_payment,
        narration=receipt_in.narration,
    )
    db.add(db_receipt)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.RECEIPT,
        voucher_date=receipt_in.receipt_date,
        narration=f"Rent receipt {db_receipt.receipt_no} — {agreement.agreement_no}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=receipt_in.credit_account_id,
            debit=receipt_in.amount,
            credit=0,
            narration=f"Rent received against {agreement.agreement_no}",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=rent_income_account.id,
            debit=0,
            credit=receipt_in.amount,
            narration=f"Rent received against {agreement.agreement_no}",
        )
    )

    db_receipt.voucher_id = voucher.id
    db.flush()
    _distribute_amount(db, agreement, db_receipt.id, float(receipt_in.amount))

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
