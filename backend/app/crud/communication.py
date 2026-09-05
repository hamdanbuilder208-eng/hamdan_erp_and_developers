from sqlalchemy.orm import Session, joinedload

from app.core import messaging
from app.models.communication import (
    CommunicationChannel,
    CommunicationLog,
    CommunicationRelatedType,
    CommunicationStatus,
)
from app.models.user import User
from app.schemas.communication import CommunicationBulkSend, CommunicationSend


def _load_query(db: Session):
    return db.query(CommunicationLog).options(joinedload(CommunicationLog.sent_by))


def get_log(db: Session, log_id: int) -> CommunicationLog | None:
    return _load_query(db).filter(CommunicationLog.id == log_id).first()


def delete_log(db: Session, db_log: CommunicationLog) -> None:
    db.delete(db_log)
    db.commit()


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


def _dispatch(channel: CommunicationChannel, phone: str, body: str):
    if channel == CommunicationChannel.SMS:
        return messaging.send_sms(phone, body)
    return messaging.send_whatsapp(phone, body)


def send_and_log(db: Session, send_in: CommunicationSend, user: User) -> CommunicationLog:
    success, provider_message_id, error_message = _dispatch(
        send_in.channel, send_in.recipient_phone, send_in.message_body
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


def send_bulk(db: Session, bulk_in: CommunicationBulkSend, user: User) -> list[CommunicationLog]:
    """Sends the same message to every recipient one at a time, logging each
    individually — one recipient's failure (bad number, provider error) never
    blocks the rest of the batch."""
    logs: list[CommunicationLog] = []
    for recipient in bulk_in.recipients:
        success, provider_message_id, error_message = _dispatch(
            bulk_in.channel, recipient.phone, bulk_in.message_body
        )
        log = CommunicationLog(
            channel=bulk_in.channel,
            recipient_phone=recipient.phone,
            recipient_name=recipient.name,
            message_body=bulk_in.message_body,
            related_type=bulk_in.related_type,
            related_id=None,
            status=CommunicationStatus.SENT if success else CommunicationStatus.FAILED,
            provider_message_id=provider_message_id,
            error_message=error_message,
            sent_by_user_id=user.id,
        )
        db.add(log)
        logs.append(log)

    db.commit()
    for log in logs:
        db.refresh(log)
    return logs
