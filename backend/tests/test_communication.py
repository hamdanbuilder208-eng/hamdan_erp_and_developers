import pytest
from sqlalchemy.orm import Session

from app.crud import communication as communication_crud
from app.crud import user as user_crud
from app.models.communication import CommunicationChannel, CommunicationStatus
from app.schemas.communication import BulkRecipient, CommunicationBulkSend, CommunicationSend
from app.schemas.user import RoleCreate, UserCreate


@pytest.fixture()
def sender(db: Session):
    role = user_crud.create_role(db, RoleCreate(name="Sales"))
    return user_crud.create_user(db, UserCreate(username="agent1", password="secret123", role_id=role.id))


def test_send_and_log_records_failure_when_provider_unavailable(db: Session, sender, monkeypatch):
    """Never let a test actually call Twilio — patch the dispatch functions
    regardless of whether real credentials happen to be configured."""
    monkeypatch.setattr(
        "app.crud.communication.messaging.send_sms", lambda to, body: (False, None, "not configured")
    )

    log = communication_crud.send_and_log(
        db,
        CommunicationSend(
            channel=CommunicationChannel.SMS, recipient_phone="+923001234567", message_body="Hello"
        ),
        sender,
    )

    assert log.status == CommunicationStatus.FAILED
    assert log.error_message == "not configured"
    assert log.sent_by_user_id == sender.id


def test_send_and_log_records_success(db: Session, sender, monkeypatch):
    monkeypatch.setattr(
        "app.crud.communication.messaging.send_whatsapp", lambda to, body: (True, "SM123", None)
    )

    log = communication_crud.send_and_log(
        db,
        CommunicationSend(
            channel=CommunicationChannel.WHATSAPP, recipient_phone="+923001234567", message_body="Hi"
        ),
        sender,
    )

    assert log.status == CommunicationStatus.SENT
    assert log.provider_message_id == "SM123"


def test_send_bulk_logs_each_recipient_independently_on_mixed_results(db: Session, sender, monkeypatch):
    """One recipient failing (bad number) must not stop the rest of the batch —
    each recipient gets dispatched and logged on its own."""
    results = iter([(True, "SM1", None), (False, None, "invalid number"), (True, "SM3", None)])
    monkeypatch.setattr(
        "app.crud.communication.messaging.send_sms", lambda to, body: next(results)
    )

    logs = communication_crud.send_bulk(
        db,
        CommunicationBulkSend(
            channel=CommunicationChannel.SMS,
            recipients=[
                BulkRecipient(phone="+92300", name="A"),
                BulkRecipient(phone="+92301", name="B"),
                BulkRecipient(phone="+92302", name="C"),
            ],
            message_body="Reminder",
        ),
        sender,
    )

    assert len(logs) == 3
    assert [l.status for l in logs] == [
        CommunicationStatus.SENT,
        CommunicationStatus.FAILED,
        CommunicationStatus.SENT,
    ]
