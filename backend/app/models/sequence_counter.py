from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base


class SequenceCounter(Base):
    """Remembers the last number handed out per prefix (e.g. "PO-"), so a
    deleted document's number is never issued again and the series only ever
    moves forward."""

    __tablename__ = "sequence_counters"

    prefix: Mapped[str] = mapped_column(String(20), primary_key=True)
    last_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
