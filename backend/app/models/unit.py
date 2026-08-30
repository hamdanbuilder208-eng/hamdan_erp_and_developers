import enum

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class UnitStatus(str, enum.Enum):
    AVAILABLE = "Available"
    BOOKED = "Booked"
    SOLD = "Sold"
    CANCELLED = "Cancelled"
    ON_HOLD = "On-Hold"


class UnitCategory(Base, TimestampMixin):
    __tablename__ = "unit_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    base_price: Mapped[float | None] = mapped_column(Numeric(18, 2))

    units: Mapped[list["Unit"]] = relationship(back_populates="unit_category")


class Unit(Base, TimestampMixin):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_ref_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    floor_id: Mapped[int | None] = mapped_column(ForeignKey("project_floors.id"))
    unit_category_id: Mapped[int | None] = mapped_column(ForeignKey("unit_categories.id"))

    unit_number: Mapped[str] = mapped_column(String(30), nullable=False)

    facility_1: Mapped[str | None] = mapped_column(String(50))
    facility_2: Mapped[str | None] = mapped_column(String(50))
    facility_3: Mapped[str | None] = mapped_column(String(50))
    facility_4: Mapped[str | None] = mapped_column(String(50))

    extra_charges: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    base_price: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    total_price: Mapped[float] = mapped_column(Numeric(18, 2), default=0)

    status: Mapped[UnitStatus] = mapped_column(Enum(UnitStatus), default=UnitStatus.AVAILABLE)
    picture_url: Mapped[str | None] = mapped_column(String(255))

    project: Mapped["Project"] = relationship(back_populates="units")
    floor: Mapped["ProjectFloor | None"] = relationship(back_populates="units")
    unit_category: Mapped["UnitCategory | None"] = relationship(back_populates="units")
