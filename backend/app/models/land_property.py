import enum

from sqlalchemy import Enum, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


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
    remarks: Mapped[str | None] = mapped_column(Text)
