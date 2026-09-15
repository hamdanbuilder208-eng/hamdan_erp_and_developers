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
    CORNER = "Corner"
    WATER = "Water"
    ELECTRICITY = "Electricity"
    DOCUMENTS = "Documents"
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

    project: Mapped["Project"] = relationship()
    unit: Mapped["Unit"] = relationship()
    allottee: Mapped["Allottee"] = relationship()
    booking_agent: Mapped["BookingAgent | None"] = relationship()

    # A booking can run several installment streams side by side — e.g. a
    # monthly installment plan AND a half-yearly one both due concurrently —
    # instead of a single fixed frequency/count. Each plan spells out its own
    # schedule lines below; due_date (not installment_no) is what actually
    # orders them, since two plans' installment numbers don't line up chronologically.
    installment_plans: Mapped[list["BookingInstallmentPlan"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="BookingInstallmentPlan.start_date"
    )
    # Each is its own line item (reason + amount) rather than one flat
    # amount/reason pair, since a unit can carry several distinct charges at
    # once (corner, road-facing, utilities, documents...). Utilities/documents
    # in particular are usually only known well after booking, so charges can
    # be added any time via add_extra_charge — not just at booking creation.
    extra_charges: Mapped[list["BookingExtraCharge"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="BookingExtraCharge.charge_date"
    )
    schedule_lines: Mapped[list["PaymentScheduleLine"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan", order_by="PaymentScheduleLine.due_date"
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


class BookingInstallmentPlan(Base, TimestampMixin):
    """One recurring installment stream within a booking — e.g. 'Monthly
    Installments' or 'Half-Yearly Installments'. A booking can have several
    of these running in parallel on top of its one-off down payment / extra
    charges lines, so mixed schedules (monthly + half-yearly together) are
    just two plans instead of a special case."""

    __tablename__ = "booking_installment_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)

    label: Mapped[str] = mapped_column(String(80), default="Installments")
    frequency: Mapped[ScheduleFrequency] = mapped_column(
        Enum(ScheduleFrequency), default=ScheduleFrequency.MONTHLY
    )
    no_of_installments: Mapped[int] = mapped_column(nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)

    booking: Mapped["Booking"] = relationship(back_populates="installment_plans")
    schedule_lines: Mapped[list["PaymentScheduleLine"]] = relationship(
        back_populates="installment_plan", order_by="PaymentScheduleLine.due_date"
    )


class BookingExtraCharge(Base, TimestampMixin):
    """One extra charge line (a reason + an amount) on top of the unit price
    — a booking can carry several of these (corner, road-facing, utilities,
    documents...) instead of a single flat amount/reason. Each one posts its
    own one-off PaymentScheduleLine and its own revenue-recognition Voucher,
    so a charge added long after booking (utilities/documents, usually only
    known near project completion) is booked exactly like one added at
    booking time — see add_extra_charge in crud/booking.py."""

    __tablename__ = "booking_extra_charges"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    schedule_line_id: Mapped[int] = mapped_column(ForeignKey("payment_schedule_lines.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    reason: Mapped[ExtraChargesReason] = mapped_column(Enum(ExtraChargesReason), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    charge_date: Mapped[date] = mapped_column(Date, nullable=False)
    narration: Mapped[str | None] = mapped_column(Text)

    booking: Mapped["Booking"] = relationship(back_populates="extra_charges")
    schedule_line: Mapped["PaymentScheduleLine"] = relationship()


class PaymentScheduleLine(Base, TimestampMixin):
    __tablename__ = "payment_schedule_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    # Null for one-off lines (down payment, extra charges) that don't belong
    # to a recurring plan.
    installment_plan_id: Mapped[int | None] = mapped_column(ForeignKey("booking_installment_plans.id"))

    installment_no: Mapped[int] = mapped_column(default=0)
    label: Mapped[str] = mapped_column(String(50), default="Installment")
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    mode_of_payment: Mapped[PaymentMode] = mapped_column(Enum(PaymentMode), default=PaymentMode.CASH)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    discount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    paid_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    booking: Mapped["Booking"] = relationship(back_populates="schedule_lines")
    installment_plan: Mapped["BookingInstallmentPlan | None"] = relationship(back_populates="schedule_lines")
