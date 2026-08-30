from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.crud.partner import get_partner_summary
from app.models.account import Account
from app.models.partner import PartnerDrawing
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.partner import PartnerDrawingCreate

PARTNER_EQUITY_ACCOUNT_CODE = "3020"


def _next_drawing_no(db: Session) -> str:
    return next_sequence_number(db, PartnerDrawing.drawing_no, "DRW-", 5)


def _next_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "PV-", 5)


def _load_query(db: Session):
    return db.query(PartnerDrawing).options(
        joinedload(PartnerDrawing.partner),
        joinedload(PartnerDrawing.credit_account),
    )


def list_drawings(db: Session, partner_id: int | None = None, project_id: int | None = None):
    query = _load_query(db)
    if partner_id is not None:
        query = query.filter(PartnerDrawing.partner_id == partner_id)
    if project_id is not None:
        query = query.filter(PartnerDrawing.project_id == project_id)
    return query.order_by(PartnerDrawing.id.desc()).all()


def get_drawing(db: Session, drawing_id: int) -> PartnerDrawing | None:
    return _load_query(db).filter(PartnerDrawing.id == drawing_id).first()


def create_drawing(db: Session, drawing_in: PartnerDrawingCreate) -> PartnerDrawing:
    summary = get_partner_summary(db, drawing_in.partner_id)
    if not summary:
        raise ValueError("Partner not found")

    row = next((r for r in summary.projects if r.project_id == drawing_in.project_id), None)
    if not row:
        raise ValueError("This partner has no share configured for the selected project")

    if drawing_in.amount > row.balance + 0.01:
        raise ValueError(
            f"Drawing exceeds the partner's balance for this project. Available balance is "
            f"PKR {row.balance:,.2f}"
        )

    equity_account = db.query(Account).filter(Account.code == PARTNER_EQUITY_ACCOUNT_CODE).first()
    if not equity_account:
        raise ValueError(
            f"Partner Equity account (code {PARTNER_EQUITY_ACCOUNT_CODE}) not found in chart of accounts"
        )

    db_drawing = PartnerDrawing(
        drawing_no=_next_drawing_no(db),
        drawing_date=drawing_in.drawing_date,
        partner_id=drawing_in.partner_id,
        project_id=drawing_in.project_id,
        credit_account_id=drawing_in.credit_account_id,
        amount=drawing_in.amount,
        narration=drawing_in.narration,
    )
    db.add(db_drawing)
    db.flush()

    voucher = Voucher(
        voucher_no=_next_voucher_no(db),
        voucher_type=VoucherType.PAYMENT,
        voucher_date=drawing_in.drawing_date,
        project_id=drawing_in.project_id,
        narration=f"Partner drawing {db_drawing.drawing_no}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=equity_account.id,
            debit=drawing_in.amount,
            credit=0,
            narration="Partner drawing",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=drawing_in.credit_account_id,
            debit=0,
            credit=drawing_in.amount,
            narration="Partner drawing paid",
        )
    )

    db_drawing.voucher_id = voucher.id
    db.commit()
    return get_drawing(db, db_drawing.id)


def delete_drawing(db: Session, db_drawing: PartnerDrawing) -> None:
    voucher_id = db_drawing.voucher_id
    db.delete(db_drawing)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()
