from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.crud import communication as comm_crud
from app.db.session import get_db
from app.models.communication import CommunicationChannel, CommunicationRelatedType
from app.models.user import User
from app.schemas.communication import (
    CommunicationBulkResult,
    CommunicationBulkSend,
    CommunicationLogOut,
    CommunicationSend,
)

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


@router.post("/send-bulk", response_model=CommunicationBulkResult, status_code=status.HTTP_201_CREATED)
def send_bulk_communication(
    bulk_in: CommunicationBulkSend,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not bulk_in.recipients:
        raise HTTPException(status_code=400, detail="Select at least one recipient")
    logs = comm_crud.send_bulk(db, bulk_in, current_user)
    sent = sum(1 for l in logs if l.status.value == "Sent")
    return CommunicationBulkResult(
        total=len(logs), sent=sent, failed=len(logs) - sent, logs=logs
    )


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_communication(log_id: int, db: Session = Depends(get_db)):
    db_log = comm_crud.get_log(db, log_id)
    if not db_log:
        raise HTTPException(status_code=404, detail="Message log not found")
    comm_crud.delete_log(db, db_log)
