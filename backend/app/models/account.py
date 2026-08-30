import enum

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class AccountNature(str, enum.Enum):
    ASSET = "Asset"
    LIABILITY = "Liability"
    CAPITAL = "Capital"
    REVENUE = "Revenue"
    EXPENSE = "Expense"


class PartyType(str, enum.Enum):
    CUSTOMER = "Customer"
    VENDOR = "Vendor"
    OTHER = "Other"


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)

    parent_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    parent: Mapped["Account | None"] = relationship(remote_side=[id], back_populates="children")
    children: Mapped[list["Account"]] = relationship(back_populates="parent")

    nature: Mapped[AccountNature] = mapped_column(Enum(AccountNature), nullable=False)
    is_control: Mapped[bool] = mapped_column(Boolean, default=False)
    party_type: Mapped[PartyType | None] = mapped_column(Enum(PartyType))

    opening_debit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    opening_credit: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    credit_days: Mapped[int | None] = mapped_column()

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
