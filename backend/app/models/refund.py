import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class RefundType(str, enum.Enum):
    CUSTOMER = "Customer"
    VENDOR = "Vendor"
    EMPLOYEE = "Employee"


class Refund(Base, TimestampMixin):
    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(primary_key=True)
    refund_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    refund_date: Mapped[date] = mapped_column(Date, nullable=False)
    refund_type: Mapped[RefundType] = mapped_column(Enum(RefundType), nullable=False)

    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"))
    party_name: Mapped[str | None] = mapped_column(String(150))

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    cash_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    gross_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    deduction_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    deduction_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    net_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    narration: Mapped[str | None] = mapped_column(Text)

    booking: Mapped["Booking | None"] = relationship()
    account: Mapped["Account"] = relationship(foreign_keys=[account_id])
    cash_account: Mapped["Account"] = relationship(foreign_keys=[cash_account_id])
