import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class ReceiptPaymentType(str, enum.Enum):
    BOOKING = "Booking"
    INSTALLMENT = "Installment"
    EXTRA_CHARGES = "Extra Charges"
    DOCUMENTATION_CHARGES = "Documentation Charges"


class Receipt(Base, TimestampMixin):
    __tablename__ = "receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)

    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    credit_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    payment_type: Mapped[ReceiptPaymentType] = mapped_column(
        Enum(ReceiptPaymentType), default=ReceiptPaymentType.INSTALLMENT
    )
    mode_of_payment: Mapped[str] = mapped_column(String(30), default="Cash")
    cheque_no: Mapped[str | None] = mapped_column(String(50))
    cheque_date: Mapped[date | None] = mapped_column(Date)
    narration: Mapped[str | None] = mapped_column(Text)

    booking: Mapped["Booking"] = relationship()
    credit_account: Mapped["Account"] = relationship()
    allocations: Mapped[list["ReceiptAllocation"]] = relationship(
        back_populates="receipt", cascade="all, delete-orphan"
    )


class ReceiptAllocation(Base, TimestampMixin):
    """Records exactly which schedule line(s) a receipt's amount was applied to,
    and how much — so deleting one receipt can reverse precisely its own
    contribution instead of guessing from installment order (which breaks as
    soon as receipts aren't deleted in the exact reverse of their creation
    order, e.g. deleting an older receipt while newer ones still exist)."""

    __tablename__ = "receipt_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_id: Mapped[int] = mapped_column(ForeignKey("receipts.id"), nullable=False)
    schedule_line_id: Mapped[int] = mapped_column(
        ForeignKey("payment_schedule_lines.id"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    receipt: Mapped["Receipt"] = relationship(back_populates="allocations")
    schedule_line: Mapped["PaymentScheduleLine"] = relationship()
