from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import booking as booking_crud
from app.db.session import get_db
from app.models.booking import BookingStatus
from app.schemas.booking import (
    BookingAgentAssign,
    BookingCreate,
    BookingOut,
    BookingStatusUpdate,
    BookingTransferCreate,
    BookingTransferOut,
    ExtraChargeCreate,
)

router = APIRouter()


@router.get("/", response_model=list[BookingOut])
def list_bookings(
    project_id: int | None = None,
    allottee_id: int | None = None,
    status_filter: BookingStatus | None = None,
    db: Session = Depends(get_db),
):
    return booking_crud.list_bookings(
        db, project_id=project_id, allottee_id=allottee_id, status=status_filter
    )


@router.post("/", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(booking_in: BookingCreate, db: Session = Depends(get_db)):
    try:
        return booking_crud.create_booking(db, booking_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    db_booking = booking_crud.get_booking(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return db_booking


@router.put("/{booking_id}/status", response_model=BookingOut)
def update_booking_status(
    booking_id: int, status_in: BookingStatusUpdate, db: Session = Depends(get_db)
):
    db_booking = booking_crud.get_booking(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking_crud.update_booking_status(db, db_booking, status_in.status, status_in.status_date)


@router.put("/{booking_id}/agent", response_model=BookingOut)
def assign_booking_agent(
    booking_id: int, agent_in: BookingAgentAssign, db: Session = Depends(get_db)
):
    db_booking = booking_crud.get_booking(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking_crud.assign_agent(
        db, db_booking, agent_in.booking_agent_id, agent_in.agent_commission_percent
    )


@router.get("/{booking_id}/transfers", response_model=list[BookingTransferOut])
def list_booking_transfers(booking_id: int, db: Session = Depends(get_db)):
    return booking_crud.list_transfers(db, booking_id)


@router.post(
    "/{booking_id}/transfer", response_model=BookingTransferOut, status_code=status.HTTP_201_CREATED
)
def transfer_booking(
    booking_id: int, transfer_in: BookingTransferCreate, db: Session = Depends(get_db)
):
    db_booking = booking_crud.get_booking(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    try:
        return booking_crud.create_transfer(db, db_booking, transfer_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(booking_id: int, db: Session = Depends(get_db)):
    db_booking = booking_crud.get_booking(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    delete_with_fk_guard(db, lambda: booking_crud.delete_booking(db, db_booking), "booking")


@router.post(
    "/{booking_id}/extra-charges", response_model=BookingOut, status_code=status.HTTP_201_CREATED
)
def add_extra_charge(booking_id: int, charge_in: ExtraChargeCreate, db: Session = Depends(get_db)):
    db_booking = booking_crud.get_booking(db, booking_id)
    if not db_booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    try:
        return booking_crud.add_extra_charge(db, db_booking, charge_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/extra-charges/{charge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_extra_charge(charge_id: int, db: Session = Depends(get_db)):
    db_charge = booking_crud.get_extra_charge(db, charge_id)
    if not db_charge:
        raise HTTPException(status_code=404, detail="Extra charge not found")
    try:
        booking_crud.delete_extra_charge(db, db_charge)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
