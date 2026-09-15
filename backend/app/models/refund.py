import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class RefundType(str, enum.Enum):
    CUSTOMER = "Customer"
    VENDOR = "Vendor"
    EMPLOYEE = "Employee"


class RefundStatus(str, enum.Enum):
    PENDING = "Pending"
    PARTIALLY_PAID = "Partially Paid"
    PAID = "Paid"


class Refund(Base, TimestampMixin):
    """What's owed and to whom — the actual money movements are separate
    RefundPayment rows below, since a refund is rarely paid out in one go
    (e.g. PKR 10 lac now, the rest over the next few months)."""

    __tablename__ = "refunds"

    id: Mapped[int] = mapped_column(primary_key=True)
    refund_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    refund_date: Mapped[date] = mapped_column(Date, nullable=False)
    refund_type: Mapped[RefundType] = mapped_column(Enum(RefundType), nullable=False)
    status: Mapped[RefundStatus] = mapped_column(Enum(RefundStatus), default=RefundStatus.PENDING)

    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id"))
    party_name: Mapped[str | None] = mapped_column(String(150))

    gross_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    deduction_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    deduction_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    net_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    narration: Mapped[str | None] = mapped_column(Text)

    booking: Mapped["Booking | None"] = relationship()
    payments: Mapped[list["RefundPayment"]] = relationship(
        back_populates="refund", cascade="all, delete-orphan", order_by="RefundPayment.payment_date"
    )


class RefundPayment(Base, TimestampMixin):
    """One installment actually paid out against a Refund — its own
    complete journal entry (account_id <-> cash_account_id), so each
    installment is independently traceable and reversible."""

    __tablename__ = "refund_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    refund_id: Mapped[int] = mapped_column(ForeignKey("refunds.id"), nullable=False)

    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    cash_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    narration: Mapped[str | None] = mapped_column(Text)

    refund: Mapped["Refund"] = relationship(back_populates="payments")
    account: Mapped["Account"] = relationship(foreign_keys=[account_id])
    cash_account: Mapped["Account"] = relationship(foreign_keys=[cash_account_id])
