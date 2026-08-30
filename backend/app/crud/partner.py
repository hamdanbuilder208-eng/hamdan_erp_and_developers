from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import AccountNature
from app.models.partner import Partner, PartnerDrawing, ProjectPartnerShare
from app.models.project import Project
from app.models.voucher import Voucher, VoucherLine
from app.schemas.partner import (
    PartnerCreate,
    PartnerProjectRow,
    PartnerSummary,
    PartnerUpdate,
    ProjectPartnerShareCreate,
)


def _next_partner_code(db: Session) -> str:
    return next_sequence_number(db, Partner.partner_code, "INV-", 5)


def list_partners(db: Session) -> list[Partner]:
    return (
        db.query(Partner)
        .options(joinedload(Partner.linked_account))
        .order_by(Partner.id.desc())
        .all()
    )


def get_partner(db: Session, partner_id: int) -> Partner | None:
    return (
        db.query(Partner)
        .options(joinedload(Partner.linked_account))
        .filter(Partner.id == partner_id)
        .first()
    )


def create_partner(db: Session, partner_in: PartnerCreate) -> Partner:
    db_partner = Partner(partner_code=_next_partner_code(db), **partner_in.model_dump())
    db.add(db_partner)
    db.commit()
    db.refresh(db_partner)
    return db_partner


def update_partner(db: Session, db_partner: Partner, partner_in: PartnerUpdate) -> Partner:
    for field, value in partner_in.model_dump(exclude_unset=True).items():
        setattr(db_partner, field, value)
    db.commit()
    db.refresh(db_partner)
    return db_partner


def delete_partner(db: Session, db_partner: Partner) -> None:
    shares = db.query(ProjectPartnerShare).filter(ProjectPartnerShare.partner_id == db_partner.id).all()
    if shares:
        refs = ", ".join(s.project.project_name for s in shares)
        raise ValueError(
            f"This partner has a share in {len(shares)} project(s): {refs}. "
            "Remove those shares first."
        )
    db.delete(db_partner)
    db.commit()


# Project Partner Shares


def list_project_shares(db: Session, project_id: int) -> list[ProjectPartnerShare]:
    return (
        db.query(ProjectPartnerShare)
        .options(joinedload(ProjectPartnerShare.partner))
        .filter(ProjectPartnerShare.project_id == project_id)
        .all()
    )


def add_project_share(
    db: Session, project_id: int, share_in: ProjectPartnerShareCreate
) -> ProjectPartnerShare:
    existing = list_project_shares(db, project_id)
    current_total = sum(float(s.share_percent) for s in existing)
    if current_total + share_in.share_percent > 100 + 0.01:
        raise ValueError(
            f"Total share cannot exceed 100%. Currently allocated: {current_total}%, "
            f"remaining: {100 - current_total}%"
        )

    db_share = ProjectPartnerShare(project_id=project_id, **share_in.model_dump())
    db.add(db_share)
    db.commit()
    db.refresh(db_share)
    return db_share


def get_share(db: Session, share_id: int) -> ProjectPartnerShare | None:
    return db.query(ProjectPartnerShare).filter(ProjectPartnerShare.id == share_id).first()


def delete_share(db: Session, db_share: ProjectPartnerShare) -> None:
    db.delete(db_share)
    db.commit()


# Profit calculation


def compute_project_profit(db: Session, project_id: int) -> tuple[float, float]:
    lines = (
        db.query(VoucherLine)
        .join(Voucher, VoucherLine.voucher_id == Voucher.id)
        .join(VoucherLine.account)
        .filter(Voucher.project_id == project_id)
        .all()
    )
    revenue = sum(
        float(l.credit) - float(l.debit) for l in lines if l.account.nature == AccountNature.REVENUE
    )
    expense = sum(
        float(l.debit) - float(l.credit) for l in lines if l.account.nature == AccountNature.EXPENSE
    )
    return round(revenue, 2), round(expense, 2)


def get_partner_summary(db: Session, partner_id: int) -> PartnerSummary | None:
    partner = get_partner(db, partner_id)
    if not partner:
        return None

    shares = (
        db.query(ProjectPartnerShare)
        .options(joinedload(ProjectPartnerShare.project))
        .filter(ProjectPartnerShare.partner_id == partner_id)
        .all()
    )

    rows: list[PartnerProjectRow] = []
    for share in shares:
        revenue, expense = compute_project_profit(db, share.project_id)
        net_profit = revenue - expense
        partner_share_amount = round(net_profit * float(share.share_percent) / 100, 2)

        drawn = (
            db.query(PartnerDrawing)
            .filter(
                PartnerDrawing.partner_id == partner_id,
                PartnerDrawing.project_id == share.project_id,
            )
            .all()
        )
        drawn_amount = round(sum(float(d.amount) for d in drawn), 2)

        rows.append(
            PartnerProjectRow(
                project_id=share.project_id,
                project_name=share.project.project_name,
                share_percent=float(share.share_percent),
                investment_amount=float(share.investment_amount),
                project_revenue=revenue,
                project_expense=expense,
                project_net_profit=round(net_profit, 2),
                partner_share_amount=partner_share_amount,
                drawn_amount=drawn_amount,
                balance=round(partner_share_amount - drawn_amount, 2),
            )
        )

    return PartnerSummary(
        partner=partner,
        projects=rows,
        total_share_amount=round(sum(r.partner_share_amount for r in rows), 2),
        total_drawn=round(sum(r.drawn_amount for r in rows), 2),
        total_balance=round(sum(r.balance for r in rows), 2),
    )
