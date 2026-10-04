"""Contractors Hamdan hires on its projects — anything from a full turnkey job
on a few floors to just the electrical or plumbing for a whole building — and
the running account with each: the agreement, work billed, and payments."""

import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.payment_details import PaymentModeMixin


class ContractBasis(str, enum.Enum):
    """How the contract amount is worked out."""

    LUMP_SUM = "Lump Sum"
    PER_SQ_FT = "Per Sq. Ft."
    PER_SQ_YD = "Per Sq. Yd."
    PER_FLOOR = "Per Floor"
    ITEM_RATE = "Item Rate / BOQ"


class ContractStatus(str, enum.Enum):
    ACTIVE = "Active"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class ContractorPaymentPurpose(str, enum.Enum):
    ADVANCE = "Advance"
    BILL_PAYMENT = "Bill Payment"
    RETENTION_RELEASE = "Retention Release"


class Contractor(Base, TimestampMixin):
    __tablename__ = "contractors"

    id: Mapped[int] = mapped_column(primary_key=True)
    contractor_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    cnic: Mapped[str] = mapped_column(String(20), nullable=False)
    ntn: Mapped[str | None] = mapped_column(String(30))
    # Main line of work, e.g. "Grey Structure", "Electrical" — free text with
    # suggestions in the UI, since contractors don't fit a fixed list.
    trade: Mapped[str] = mapped_column(String(80), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30))
    bank_name: Mapped[str | None] = mapped_column(String(100))
    account_iban: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(default=True)

    agreements: Mapped[list["ContractAgreement"]] = relationship(back_populates="contractor")


class ContractAgreement(Base, TimestampMixin):
    """One piece of work given to a contractor on a project — e.g. "Complete
    structure, Ground to 2nd floor, per sq. ft." or "Electrical, whole building,
    lump sum". Retention and withholding tax are deducted from every bill."""

    __tablename__ = "contract_agreements"

    id: Mapped[int] = mapped_column(primary_key=True)
    agreement_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    agreement_date: Mapped[date] = mapped_column(Date, nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    contractor_id: Mapped[int] = mapped_column(ForeignKey("contractors.id"), nullable=False)

    scope_title: Mapped[str] = mapped_column(String(200), nullable=False)
    work_type: Mapped[str] = mapped_column(String(80), nullable=False)
    # Which part of the building, e.g. "Ground to 2nd Floor", "Whole building".
    floors_scope: Mapped[str | None] = mapped_column(String(150))

    basis: Mapped[ContractBasis] = mapped_column(Enum(ContractBasis), nullable=False)
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 2))  # sq ft / sq yd / floors
    rate: Mapped[float | None] = mapped_column(Numeric(18, 2))
    contract_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    retention_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    wht_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[ContractStatus] = mapped_column(Enum(ContractStatus), default=ContractStatus.ACTIVE)
    remarks: Mapped[str | None] = mapped_column(Text)

    project: Mapped["Project"] = relationship()
    contractor: Mapped["Contractor"] = relationship(back_populates="agreements")
    bills: Mapped[list["ContractorBill"]] = relationship(
        back_populates="agreement", cascade="all, delete-orphan", order_by="ContractorBill.bill_date"
    )
    payments: Mapped[list["ContractorPayment"]] = relationship(
        back_populates="agreement", order_by="ContractorPayment.payment_date"
    )

    @property
    def project_name(self) -> str:
        return self.project.project_name if self.project else ""


class ContractorBill(Base, TimestampMixin):
    """Work done and certified (a running or final bill). Retention and WHT
    are worked out from the agreement's percentages when it's recorded."""

    __tablename__ = "contractor_bills"

    id: Mapped[int] = mapped_column(primary_key=True)
    bill_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("contract_agreements.id"), nullable=False)
    bill_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    work_quantity: Mapped[float | None] = mapped_column(Numeric(14, 2))
    gross_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    retention_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    wht_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    net_amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    agreement: Mapped["ContractAgreement"] = relationship(back_populates="bills")


class ContractorPayment(Base, PaymentModeMixin, TimestampMixin):
    """Money actually paid to the contractor — booked as the project's
    construction cost."""

    __tablename__ = "contractor_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    payment_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    agreement_id: Mapped[int] = mapped_column(ForeignKey("contract_agreements.id"), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    purpose: Mapped[ContractorPaymentPurpose] = mapped_column(
        Enum(ContractorPaymentPurpose), default=ContractorPaymentPurpose.BILL_PAYMENT
    )
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    credit_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))
    narration: Mapped[str | None] = mapped_column(Text)

    agreement: Mapped["ContractAgreement"] = relationship(back_populates="payments")
    credit_account: Mapped["Account"] = relationship()
