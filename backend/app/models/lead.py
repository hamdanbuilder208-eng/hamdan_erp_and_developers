from datetime import date

from sqlalchemy import Date, String, Text
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
    # Where sales stands with the lead (New, Called, No Answer, Interested,
    # Not Interested, Booked) — set from the Leads page after each call.
    follow_up_status: Mapped[str] = mapped_column(
        String(30), default="New", server_default="New", nullable=False
    )
    # When the follow-up status was last changed (i.e. the last call).
    follow_up_date: Mapped[date | None] = mapped_column(Date)
