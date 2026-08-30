import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class VoucherType(str, enum.Enum):
    RECEIPT = "Receipt"
    PAYMENT = "Payment"
    JOURNAL = "Journal"
    CONTRA = "Contra"


class Voucher(Base, TimestampMixin):
    __tablename__ = "vouchers"

    id: Mapped[int] = mapped_column(primary_key=True)
    voucher_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    voucher_type: Mapped[VoucherType] = mapped_column(Enum(VoucherType), nullable=False)
    voucher_date: Mapped[date] = mapped_column(Date, nullable=False)

    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    narration: Mapped[str | None] = mapped_column(Text)

    lines: Mapped[list["VoucherLine"]] = relationship(
        back_populates="voucher", cascade="all, delete-orphan"
    )


class VoucherLine(Base, TimestampMixin):
    __tablename__ = "voucher_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    voucher_id: Mapped[int] = mapped_column(ForeignKey("vouchers.id"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)

    debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    narration: Mapped[str | None] = mapped_column(String(255))

    voucher: Mapped["Voucher"] = relationship(back_populates="lines")
    account: Mapped["Account"] = relationship()
