import enum

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.booking import ScheduleFrequency


class ProjectStatus(str, enum.Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"


class ProjectGroup(Base, TimestampMixin):
    __tablename__ = "project_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    projects: Mapped[list["Project"]] = relationship(back_populates="project_group")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    project_name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    total_budget: Mapped[float | None] = mapped_column(Numeric(18, 2))
    commission_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), default=0)
    total_floors: Mapped[int | None] = mapped_column(default=0)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.ACTIVE
    )

    project_group_id: Mapped[int | None] = mapped_column(ForeignKey("project_groups.id"))
    project_group: Mapped["ProjectGroup | None"] = relationship(back_populates="projects")

    floors: Mapped[list["ProjectFloor"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    units: Mapped[list["Unit"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    payment_template: Mapped["ProjectPaymentTemplate | None"] = relationship(
        back_populates="project", cascade="all, delete-orphan", uselist=False
    )


class ProjectFloor(Base, TimestampMixin):
    __tablename__ = "project_floors"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    block: Mapped[str | None] = mapped_column(String(50))
    floor_no: Mapped[str] = mapped_column(String(20), nullable=False)
    no_of_units: Mapped[int] = mapped_column(default=0)

    project: Mapped["Project"] = relationship(back_populates="floors")
    units: Mapped[list["Unit"]] = relationship(back_populates="floor")


class ProjectPaymentTemplate(Base, TimestampMixin):
    """A project's standard payment plan, expressed as percentages of a
    unit's price so the same template applies regardless of which unit gets
    booked — e.g. 10% booking, 15% one-off 'allocation' a month later, 50%
    over 24 monthly installments, 25% over 4 half-yearly installments (a
    2-year project's worth at 2/year). Booking a unit can pull this in to
    prefill its down payment + installment plans instead of typing it out
    fresh every time — see BookingsPage's 'Use Standard Schedule'."""

    __tablename__ = "project_payment_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), unique=True, nullable=False)
    booking_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    project: Mapped["Project"] = relationship(back_populates="payment_template")
    lines: Mapped[list["ProjectPaymentTemplateLine"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="ProjectPaymentTemplateLine.months_after_booking",
    )


class ProjectPaymentTemplateLine(Base, TimestampMixin):
    """One recurring slice of the template — e.g. 'Monthly Installments' or
    'Half-Yearly Installments' — mirroring BookingInstallmentPlan but as a
    percent of price instead of a fixed amount, and start_date relative to
    the booking date (months_after_booking) instead of an absolute date."""

    __tablename__ = "project_payment_template_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("project_payment_templates.id"), nullable=False)

    label: Mapped[str] = mapped_column(String(80), default="Installments")
    frequency: Mapped[ScheduleFrequency] = mapped_column(
        Enum(ScheduleFrequency), default=ScheduleFrequency.MONTHLY
    )
    no_of_installments: Mapped[int] = mapped_column(nullable=False)
    percent: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    months_after_booking: Mapped[int] = mapped_column(default=0)

    template: Mapped["ProjectPaymentTemplate"] = relationship(back_populates="lines")
