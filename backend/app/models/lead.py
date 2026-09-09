from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class Lead(Base, TimestampMixin):
    """A prospective customer's contact info — captured before any booking
    exists, typically imported in bulk from a marketing spreadsheet, so sales
    can WhatsApp/SMS them without re-typing numbers from Excel by hand."""

    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    mobile: Mapped[str] = mapped_column(String(30), nullable=False)
    source: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
