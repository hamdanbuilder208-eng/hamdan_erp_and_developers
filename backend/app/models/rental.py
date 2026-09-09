import enum
from datetime import date

from sqlalchemy import CheckConstraint, Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    cnic: Mapped[str | None] = mapped_column(String(20))
    mobile: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(Text)


class RentAgreementStatus(str, enum.Enum):
    ACTIVE = "Active"
    TERMINATED = "Terminated"
    EXPIRED = "Expired"


class RentAgreement(Base, TimestampMixin):
    """A shop (a project Unit) or a standalone extra property (a LandProperty)
    rented out to a tenant — exactly one of unit_id / land_property_id is set.
    Renting never recognizes revenue up front the way a sale booking does;
    each month's rent is only posted to accounts once actually collected via
    a RentReceipt, same principle as Receipt for a sale booking."""

    __tablename__ = "rent_agreements"
    __table_args__ = (
        CheckConstraint(
            "(unit_id IS NOT NULL AND land_property_id IS NULL) OR "
            "(unit_id IS NULL AND land_property_id IS NOT NULL)",
            name="rent_agreement_exactly_one_target",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    agreement_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    agreement_date: Mapped[date] = mapped_column(Date, nullable=False)

    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    unit_id: Mapped[int | None] = mapped_column(ForeignKey("units.id"))
    land_property_id: Mapped[int | None] = mapped_column(ForeignKey("land_properties.id"))

    monthly_rent: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    security_deposit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    duration_months: Mapped[int] = mapped_column(nullable=False)

    status: Mapped[RentAgreementStatus] = mapped_column(
        Enum(RentAgreementStatus), default=RentAgreementStatus.ACTIVE
    )
    narration: Mapped[str | None] = mapped_column(Text)

    tenant: Mapped["Tenant"] = relationship()
    unit: Mapped["Unit | None"] = relationship()
    land_property: Mapped["LandProperty | None"] = relationship()
    schedule_lines: Mapped[list["RentScheduleLine"]] = relationship(
        back_populates="agreement", cascade="all, delete-orphan", order_by="RentScheduleLine.month_no"
    )


class RentScheduleLine(Base, TimestampMixin):
    __tablename__ = "rent_schedule_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("rent_agreements.id"), nullable=False)

    month_no: Mapped[int] = mapped_column(nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    paid_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    agreement: Mapped["RentAgreement"] = relationship(back_populates="schedule_lines")


class RentReceipt(Base, TimestampMixin):
    __tablename__ = "rent_receipts"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    receipt_date: Mapped[date] = mapped_column(Date, nullable=False)

    agreement_id: Mapped[int] = mapped_column(ForeignKey("rent_agreements.id"), nullable=False)
    credit_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    mode_of_payment: Mapped[str] = mapped_column(String(30), default="Cash")
    narration: Mapped[str | None] = mapped_column(Text)

    agreement: Mapped["RentAgreement"] = relationship()
    credit_account: Mapped["Account"] = relationship()


class RentReceiptAllocation(Base, TimestampMixin):
    """Same purpose as booking's ReceiptAllocation: records exactly which
    schedule line(s) a rent receipt's amount landed on, so deleting one
    receipt reverses precisely its own contribution."""

    __tablename__ = "rent_receipt_allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    rent_receipt_id: Mapped[int] = mapped_column(ForeignKey("rent_receipts.id"), nullable=False)
    schedule_line_id: Mapped[int] = mapped_column(ForeignKey("rent_schedule_lines.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    rent_receipt: Mapped["RentReceipt"] = relationship()
    schedule_line: Mapped["RentScheduleLine"] = relationship()
