import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class OfficeExpense(Base, TimestampMixin):
    __tablename__ = "office_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)

    expense_head_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    paid_from_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    narration: Mapped[str | None] = mapped_column(Text)

    expense_head: Mapped["Account"] = relationship(foreign_keys=[expense_head_id])
    project: Mapped["Project | None"] = relationship()
    paid_from: Mapped["Account"] = relationship(foreign_keys=[paid_from_id])


class WageType(str, enum.Enum):
    MONTHLY = "Monthly"
    DAILY = "Daily"


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    designation: Mapped[str | None] = mapped_column(String(100))
    site_department: Mapped[str | None] = mapped_column(String(100))
    cnic: Mapped[str | None] = mapped_column(String(20))
    contact: Mapped[str | None] = mapped_column(String(30))

    wage_type: Mapped[WageType] = mapped_column(Enum(WageType), default=WageType.MONTHLY)
    rate: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    is_active: Mapped[bool] = mapped_column(default=True)


class WagePayment(Base, TimestampMixin):
    __tablename__ = "wage_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)

    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    period_from: Mapped[date] = mapped_column(Date, nullable=False)
    period_to: Mapped[date] = mapped_column(Date, nullable=False)
    days_or_units: Mapped[float | None] = mapped_column(Numeric(6, 2))

    gross_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    advances_deductions: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    net_paid: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    paid_from_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))
    narration: Mapped[str | None] = mapped_column(Text)

    employee: Mapped["Employee"] = relationship()
    paid_from: Mapped["Account"] = relationship()


class OwnerPersonalExpense(Base, TimestampMixin):
    __tablename__ = "owner_personal_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)

    category: Mapped[str] = mapped_column(String(100), nullable=False)
    source_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)

    source_account: Mapped["Account"] = relationship()
