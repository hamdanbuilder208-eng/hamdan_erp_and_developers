from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user
from app.core.errors import delete_with_fk_guard
from app.crud import receipt as receipt_crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.receipt import (
    ChequeStatusUpdate,
    ReceiptCreate,
    ReceiptUpdate,
    ReceiptWithBookingOut,
)

router = APIRouter()


@router.get("/", response_model=list[ReceiptWithBookingOut])
def list_receipts(
    booking_id: int | None = None, project_id: int | None = None, db: Session = Depends(get_db)
):
    return receipt_crud.list_receipts(db, booking_id=booking_id, project_id=project_id)


@router.post("/", response_model=ReceiptWithBookingOut, status_code=status.HTTP_201_CREATED)
def create_receipt(receipt_in: ReceiptCreate, db: Session = Depends(get_db)):
    try:
        return receipt_crud.create_receipt(db, receipt_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/cheques/pending", response_model=list[ReceiptWithBookingOut])
def list_pending_cheques(due_by: date | None = None, db: Session = Depends(get_db)):
    """Cheques still awaiting clearing — powers the dashboard reminder.
    `due_by` defaults to today when omitted (overdue + due-today)."""
    return receipt_crud.list_pending_cheques(db, due_by=due_by or date.today())


@router.get("/{receipt_id}", response_model=ReceiptWithBookingOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)):
    db_receipt = receipt_crud.get_receipt(db, receipt_id)
    if not db_receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return db_receipt


@router.put("/{receipt_id}", response_model=ReceiptWithBookingOut)
def update_receipt(
    receipt_id: int,
    receipt_in: ReceiptUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin_user),
):
    db_receipt = receipt_crud.get_receipt(db, receipt_id)
    if not db_receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    try:
        return receipt_crud.update_receipt(db, db_receipt, receipt_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/{receipt_id}/cheque-status", response_model=ReceiptWithBookingOut)
def update_cheque_status(
    receipt_id: int, status_in: ChequeStatusUpdate, db: Session = Depends(get_db)
):
    db_receipt = receipt_crud.get_receipt(db, receipt_id)
    if not db_receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    try:
        return receipt_crud.mark_cheque_status(db, db_receipt, status_in.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    db_receipt = receipt_crud.get_receipt(db, receipt_id)
    if not db_receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    delete_with_fk_guard(db, lambda: receipt_crud.delete_receipt(db, db_receipt), "receipt")
