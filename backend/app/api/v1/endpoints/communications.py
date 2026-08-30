from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.crud import communication as comm_crud
from app.db.session import get_db
from app.models.communication import CommunicationChannel, CommunicationRelatedType
from app.models.user import User
from app.schemas.communication import CommunicationLogOut, CommunicationSend

router = APIRouter()


@router.get("/", response_model=list[CommunicationLogOut])
def list_communications(
    related_type: CommunicationRelatedType | None = None,
    related_id: int | None = None,
    channel: CommunicationChannel | None = None,
    db: Session = Depends(get_db),
):
    return comm_crud.list_logs(db, related_type=related_type, related_id=related_id, channel=channel)


@router.post("/send", response_model=CommunicationLogOut, status_code=status.HTTP_201_CREATED)
def send_communication(
    send_in: CommunicationSend,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return comm_crud.send_and_log(db, send_in, current_user)
