from sqlalchemy import ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class BookingAgent(Base, TimestampMixin):
    __tablename__ = "booking_agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_info: Mapped[str | None] = mapped_column(String(255))

    linked_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.id"))
    default_commission_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0)

    linked_account: Mapped["Account | None"] = relationship()
