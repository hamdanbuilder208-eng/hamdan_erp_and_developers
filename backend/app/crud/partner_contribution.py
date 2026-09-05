from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account
from app.models.partner import PartnerContribution
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.partner import PartnerContributionCreate

PARTNER_EQUITY_ACCOUNT_CODE = "3020"


def _next_contribution_no(db: Session) -> str:
    return next_sequence_number(db, PartnerContribution.contribution_no, "CTB-", 5)


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "RV-", 5)


def _load_query(db: Session):
    return db.query(PartnerContribution).options(
        joinedload(PartnerContribution.partner),
        joinedload(PartnerContribution.debit_account),
    )


def list_contributions(db: Session, partner_id: int | None = None, project_id: int | None = None):
    query = _load_query(db)
    if partner_id is not None:
        query = query.filter(PartnerContribution.partner_id == partner_id)
    if project_id is not None:
        query = query.filter(PartnerContribution.project_id == project_id)
    return query.order_by(PartnerContribution.id.desc()).all()


def get_contribution(db: Session, contribution_id: int) -> PartnerContribution | None:
    return _load_query(db).filter(PartnerContribution.id == contribution_id).first()


def create_contribution(
    db: Session, contribution_in: PartnerContributionCreate
) -> PartnerContribution:
    equity_account = db.query(Account).filter(Account.code == PARTNER_EQUITY_ACCOUNT_CODE).first()
    if not equity_account:
        raise ValueError(
            f"Partner Equity account (code {PARTNER_EQUITY_ACCOUNT_CODE}) not found in chart of accounts"
        )

    db_contribution = PartnerContribution(
        contribution_no=_next_contribution_no(db),
        contribution_date=contribution_in.contribution_date,
        partner_id=contribution_in.partner_id,
        project_id=contribution_in.project_id,
        debit_account_id=contribution_in.debit_account_id,
        amount=contribution_in.amount,
        purpose=contribution_in.purpose,
        narration=contribution_in.narration,
    )
    db.add(db_contribution)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.RECEIPT,
        voucher_date=contribution_in.contribution_date,
        project_id=contribution_in.project_id,
        narration=f"Partner contribution {db_contribution.contribution_no}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=contribution_in.debit_account_id,
            debit=contribution_in.amount,
            credit=0,
            narration="Partner contribution received",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=equity_account.id,
            debit=0,
            credit=contribution_in.amount,
            narration="Partner contribution",
        )
    )

    db_contribution.voucher_id = voucher.id
    db.commit()
    return get_contribution(db, db_contribution.id)


def delete_contribution(db: Session, db_contribution: PartnerContribution) -> None:
    voucher_id = db_contribution.voucher_id
    db.delete(db_contribution)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()
