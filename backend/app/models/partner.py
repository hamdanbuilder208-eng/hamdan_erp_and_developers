from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class Partner(Base, TimestampMixin):
    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(primary_key=True)
    partner_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_info: Mapped[str | None] = mapped_column(String(255))
    linked_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))

    linked_account: Mapped["Account | None"] = relationship()


class ProjectPartnerShare(Base, TimestampMixin):
    __tablename__ = "project_partner_shares"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), nullable=False)

    investment_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    share_percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)

    project: Mapped["Project"] = relationship()
    partner: Mapped["Partner"] = relationship()


class PartnerDrawing(Base, TimestampMixin):
    __tablename__ = "partner_drawings"

    id: Mapped[int] = mapped_column(primary_key=True)
    drawing_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    drawing_date: Mapped[date] = mapped_column(Date, nullable=False)

    partner_id: Mapped[int] = mapped_column(ForeignKey("partners.id"), nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    credit_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    narration: Mapped[str | None] = mapped_column(Text)

    partner: Mapped["Partner"] = relationship()
    project: Mapped["Project"] = relationship()
    credit_account: Mapped["Account"] = relationship()
