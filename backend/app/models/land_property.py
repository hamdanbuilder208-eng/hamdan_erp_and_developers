import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin
from app.models.booking import PaymentMode


class PropertyType(str, enum.Enum):
    PLOT = "Plot"
    LAND = "Land"
    COMMERCIAL_SHOP = "Commercial Shop"
    SR = "SR"
    OTHER = "Other"


class SizeUnit(str, enum.Enum):
    SQ_YD = "Sq. Yd."
    SQ_FT = "Sq. Ft."
    MARLA = "Marla"
    KANAL = "Kanal"


class LandPropertyStatus(str, enum.Enum):
    AVAILABLE = "Available"
    RESERVED = "Reserved"
    SOLD = "Sold"
    RENTED = "Rented"


class LandPropertyPaymentDirection(str, enum.Enum):
    """Which way the money moves: TO_SELLER while the property is Reserved
    (Hamdan is acquiring it and paying the owner/vendor in installments),
    FROM_BUYER while it's Sold (a customer is paying Hamdan off)."""

    TO_SELLER = "To Seller"
    FROM_BUYER = "From Buyer"


class LandProperty(Base, TimestampMixin):
    __tablename__ = "land_properties"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_ref_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    property_type: Mapped[PropertyType] = mapped_column(Enum(PropertyType), nullable=False)
    area_location: Mapped[str] = mapped_column(String(150), nullable=False)

    size_number: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    size_unit: Mapped[SizeUnit] = mapped_column(Enum(SizeUnit), default=SizeUnit.SQ_YD)

    owner_vendor: Mapped[str | None] = mapped_column(String(150))
    purchase_rate: Mapped[float | None] = mapped_column(Numeric(18, 2))
    sale_rate: Mapped[float | None] = mapped_column(Numeric(18, 2))

    status: Mapped[LandPropertyStatus] = mapped_column(
        Enum(LandPropertyStatus), default=LandPropertyStatus.AVAILABLE
    )
    # Next expected installment date while payments are still outstanding —
    # seller_payment_due_date while Reserved (money Hamdan still owes the
    # seller), buyer_payment_due_date while Sold (money still owed to Hamdan).
    seller_payment_due_date: Mapped[date | None] = mapped_column(Date)
    buyer_payment_due_date: Mapped[date | None] = mapped_column(Date)
    remarks: Mapped[str | None] = mapped_column(Text)

    payments: Mapped[list["LandPropertyPayment"]] = relationship(
        back_populates="land_property",
        cascade="all, delete-orphan",
        order_by="LandPropertyPayment.payment_date",
    )


class LandPropertyPayment(Base, TimestampMixin):
    """A single installment paid to the seller (acquiring the property) or
    received from a buyer (disposing of it) — a running ledger rather than a
    fixed schedule, since these deals are negotiated case by case."""

    __tablename__ = "land_property_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    land_property_id: Mapped[int] = mapped_column(ForeignKey("land_properties.id"), nullable=False)

    direction: Mapped[LandPropertyPaymentDirection] = mapped_column(
        Enum(LandPropertyPaymentDirection), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    mode_of_payment: Mapped[PaymentMode] = mapped_column(Enum(PaymentMode), default=PaymentMode.CASH)
    narration: Mapped[str | None] = mapped_column(Text)

    land_property: Mapped["LandProperty"] = relationship(back_populates="payments")
