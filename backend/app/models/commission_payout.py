from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class CommissionPayout(Base, TimestampMixin):
    __tablename__ = "commission_payouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    payout_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    payout_date: Mapped[date] = mapped_column(Date, nullable=False)

    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    agent_id: Mapped[int] = mapped_column(ForeignKey("booking_agents.id"), nullable=False)
    credit_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    narration: Mapped[str | None] = mapped_column(Text)

    booking: Mapped["Booking"] = relationship()
    agent: Mapped["BookingAgent"] = relationship()
    credit_account: Mapped["Account"] = relationship()
