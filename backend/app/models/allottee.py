from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class Allottee(Base, TimestampMixin):
    __tablename__ = "allottees"

    id: Mapped[int] = mapped_column(primary_key=True)
    allottee_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    father_name: Mapped[str | None] = mapped_column(String(150))
    address: Mapped[str | None] = mapped_column(Text)

    mobile: Mapped[str | None] = mapped_column(String(30))
    tel_res: Mapped[str | None] = mapped_column(String(30))
    office_phone: Mapped[str | None] = mapped_column(String(30))
    fax: Mapped[str | None] = mapped_column(String(30))

    cnic: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(120))
    referred_by: Mapped[str | None] = mapped_column(String(150))
    picture_url: Mapped[str | None] = mapped_column(String(255))

    nominee_name: Mapped[str | None] = mapped_column(String(150))
    nominee_relation: Mapped[str | None] = mapped_column(String(80))
    nominee_cnic: Mapped[str | None] = mapped_column(String(20))
    nominee_picture_url: Mapped[str | None] = mapped_column(String(255))
