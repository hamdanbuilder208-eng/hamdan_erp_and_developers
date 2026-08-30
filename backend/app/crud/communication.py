from sqlalchemy.orm import Session, joinedload

from app.core import messaging
from app.models.communication import (
    CommunicationChannel,
    CommunicationLog,
    CommunicationRelatedType,
    CommunicationStatus,
)
from app.models.user import User
from app.schemas.communication import CommunicationSend


def _load_query(db: Session):
    return db.query(CommunicationLog).options(joinedload(CommunicationLog.sent_by))


def list_logs(
    db: Session,
    related_type: CommunicationRelatedType | None = None,
    related_id: int | None = None,
    channel: CommunicationChannel | None = None,
) -> list[CommunicationLog]:
    query = _load_query(db)
    if related_type is not None:
        query = query.filter(CommunicationLog.related_type == related_type)
    if related_id is not None:
        query = query.filter(CommunicationLog.related_id == related_id)
    if channel is not None:
        query = query.filter(CommunicationLog.channel == channel)
    return query.order_by(CommunicationLog.id.desc()).all()


def send_and_log(db: Session, send_in: CommunicationSend, user: User) -> CommunicationLog:
    if send_in.channel == CommunicationChannel.SMS:
        success, provider_message_id, error_message = messaging.send_sms(
            send_in.recipient_phone, send_in.message_body
        )
    else:
        success, provider_message_id, error_message = messaging.send_whatsapp(
            send_in.recipient_phone, send_in.message_body
        )

    log = CommunicationLog(
        channel=send_in.channel,
        recipient_phone=send_in.recipient_phone,
        recipient_name=send_in.recipient_name,
        message_body=send_in.message_body,
        related_type=send_in.related_type,
        related_id=send_in.related_id,
        status=CommunicationStatus.SENT if success else CommunicationStatus.FAILED,
        provider_message_id=provider_message_id,
        error_message=error_message,
        sent_by_user_id=user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
