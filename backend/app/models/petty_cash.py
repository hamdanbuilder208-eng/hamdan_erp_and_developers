from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class PettyCashFloat(Base, TimestampMixin):
    """A cash float handed to one person or site (e.g. an office boy, a site
    supervisor). Backed by its own ledger account so its running balance is
    just that account's balance — same machinery as every other account."""

    __tablename__ = "petty_cash_floats"

    id: Mapped[int] = mapped_column(primary_key=True)
    float_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    holder_name: Mapped[str] = mapped_column(String(150), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    account: Mapped["Account"] = relationship()


class PettyCashTopup(Base, TimestampMixin):
    """Owner (or accounts) handing more cash to a float."""

    __tablename__ = "petty_cash_topups"

    id: Mapped[int] = mapped_column(primary_key=True)
    topup_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    topup_date: Mapped[date] = mapped_column(Date, nullable=False)
    float_id: Mapped[int] = mapped_column(ForeignKey("petty_cash_floats.id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    paid_from_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    narration: Mapped[str | None] = mapped_column(Text)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    float: Mapped["PettyCashFloat"] = relationship()
    paid_from: Mapped["Account"] = relationship()
    voucher: Mapped["Voucher | None"] = relationship()


class PettyCashExpense(Base, TimestampMixin):
    """Something the float-holder spent on. `material_id` is set only when
    the purchase is a tracked material (adds stock, e.g. cement, wire) — plain
    spends (chai, transport, a small tool) skip it and are just an expense."""

    __tablename__ = "petty_cash_expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    float_id: Mapped[int] = mapped_column(ForeignKey("petty_cash_floats.id"), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))

    material_id: Mapped[int | None] = mapped_column(ForeignKey("materials.id"))
    quantity: Mapped[float | None] = mapped_column(Numeric(18, 2))
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))

    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    float: Mapped["PettyCashFloat"] = relationship()
    project: Mapped["Project | None"] = relationship()
    material: Mapped["Material | None"] = relationship()
    warehouse: Mapped["Warehouse | None"] = relationship()
    voucher: Mapped["Voucher | None"] = relationship()
