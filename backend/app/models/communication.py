import enum

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class CommunicationChannel(str, enum.Enum):
    SMS = "SMS"
    WHATSAPP = "WhatsApp"


class CommunicationRelatedType(str, enum.Enum):
    RECEIPT = "Receipt"
    BOOKING = "Booking"
    REFUND = "Refund"
    OTHER = "Other"


class CommunicationStatus(str, enum.Enum):
    SENT = "Sent"
    FAILED = "Failed"


class CommunicationLog(Base, TimestampMixin):
    __tablename__ = "communication_logs"

    id: Mapped[int] = mapped_column(primary_key=True)

    channel: Mapped[CommunicationChannel] = mapped_column(Enum(CommunicationChannel), nullable=False)
    recipient_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    recipient_name: Mapped[str | None] = mapped_column(String(150))
    message_body: Mapped[str] = mapped_column(Text, nullable=False)

    related_type: Mapped[CommunicationRelatedType] = mapped_column(
        Enum(CommunicationRelatedType), default=CommunicationRelatedType.OTHER
    )
    related_id: Mapped[int | None] = mapped_column()

    status: Mapped[CommunicationStatus] = mapped_column(Enum(CommunicationStatus), nullable=False)
    provider_message_id: Mapped[str | None] = mapped_column(String(80))
    error_message: Mapped[str | None] = mapped_column(Text)

    sent_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    sent_by: Mapped["User | None"] = relationship()
