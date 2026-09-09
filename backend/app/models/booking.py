import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class BookingStatus(str, enum.Enum):
    BOOKED = "Booked"
    CONFIRMED = "Confirmed"
    CANCELLED = "Cancelled"
    POSSESSION_GIVEN = "Possession Given"


class PaymentMode(str, enum.Enum):
    CASH = "Cash"
    CHEQUE = "Cheque"
    BANK_TRANSFER = "Bank Transfer"
    ONLINE = "Online"


class ScheduleFrequency(str, enum.Enum):
    MONTHLY = "Monthly"
    QUARTERLY = "Quarterly"
    HALF_YEARLY = "Half-Yearly"
    YEARLY = "Yearly"


class ExtraChargesReason(str, enum.Enum):
    EAST_FACING = "East Facing"
    WEST_FACING = "West Facing"
    OPEN = "Open"
    ROAD_FACING = "Road Facing"
    WATER = "Water"
    ELECTRICITY = "Electricity"
    OTHER = "Other"


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_ref_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    booking_date: Mapped[date] = mapped_column(Date, nullable=False)

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    unit_id: Mapped[int] = mapped_column(ForeignKey("units.id"), nullable=False)
    allottee_id: Mapped[int] = mapped_column(ForeignKey("allottees.id"), nullable=False)

    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.BOOKED)
    status_date: Mapped[date] = mapped_column(Date, nullable=False)

    discount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_price: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    remarks: Mapped[str | None] = mapped_column(Text)

    booking_agent_id: Mapped[int | None] = mapped_column(ForeignKey("booking_agents.id"))
    agent_commission_percent: Mapped[float | None] = mapped_column(Numeric(5, 2))
    revenue_voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    down_payment_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    extra_charges_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    extra_charges_reason: Mapped[ExtraChargesReason | None] = mapped_column(Enum(ExtraChargesReason))
    no_of_installments: Mapped[int] = mapped_column(default=0)
    frequency: Mapped[ScheduleFrequency] = mapped_column(
        Enum(ScheduleFrequency), default=ScheduleFrequency.MONTHLY
    )

    project: Mapped["Project"] = relationship()
    unit: Mapped["Unit"] = relationship()
    allottee: Mapped["Allottee"] = relationship()
    booking_agent: Mapped["BookingAgent | None"] = relationship()

    schedule_lines: Mapped[list["PaymentScheduleLine"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="PaymentScheduleLine.installment_no"
    )


class BookingTransfer(Base, TimestampMixin):
    """Audit trail of a booking's ownership moving from one allottee to
    another — `Booking.allottee_id` always reflects the CURRENT owner; this
    table is the only record of who held it before."""

    __tablename__ = "booking_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    transfer_date: Mapped[date] = mapped_column(Date, nullable=False)

    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    from_allottee_id: Mapped[int] = mapped_column(ForeignKey("allottees.id"), nullable=False)
    to_allottee_id: Mapped[int] = mapped_column(ForeignKey("allottees.id"), nullable=False)
    narration: Mapped[str | None] = mapped_column(Text)

    booking: Mapped["Booking"] = relationship()
    from_allottee: Mapped["Allottee"] = relationship(foreign_keys=[from_allottee_id])
    to_allottee: Mapped["Allottee"] = relationship(foreign_keys=[to_allottee_id])


class PaymentScheduleLine(Base, TimestampMixin):
    __tablename__ = "payment_schedule_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)

    installment_no: Mapped[int] = mapped_column(default=0)
    label: Mapped[str] = mapped_column(String(50), default="Installment")
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    mode_of_payment: Mapped[PaymentMode] = mapped_column(Enum(PaymentMode), default=PaymentMode.CASH)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    discount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    booking: Mapped["Booking"] = relationship(back_populates="schedule_lines")
