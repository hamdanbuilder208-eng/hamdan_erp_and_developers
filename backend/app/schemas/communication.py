from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.communication import CommunicationChannel, CommunicationRelatedType, CommunicationStatus


class CommunicationSend(BaseModel):
    channel: CommunicationChannel
    recipient_phone: str
    recipient_name: str | None = None
    message_body: str
    related_type: CommunicationRelatedType = CommunicationRelatedType.OTHER
    related_id: int | None = None


class BulkRecipient(BaseModel):
    phone: str
    name: str | None = None


class CommunicationBulkSend(BaseModel):
    channel: CommunicationChannel
    recipients: list[BulkRecipient]
    message_body: str
    related_type: CommunicationRelatedType = CommunicationRelatedType.OTHER


class CommunicationSentBy(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str


class CommunicationLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    channel: CommunicationChannel
    recipient_phone: str
    recipient_name: str | None
    message_body: str
    related_type: CommunicationRelatedType
    related_id: int | None
    status: CommunicationStatus
    provider_message_id: str | None
    error_message: str | None
    created_at: datetime
    sent_by: CommunicationSentBy | None = None


class CommunicationBulkResult(BaseModel):
    total: int
    sent: int
    failed: int
    logs: list[CommunicationLogOut]
