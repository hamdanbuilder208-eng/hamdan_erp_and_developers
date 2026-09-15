from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import refund as refund_crud
from app.db.session import get_db
from app.models.refund import RefundType
from app.schemas.refund import RefundCreate, RefundDeductionUpdate, RefundOut, RefundPaymentCreate

router = APIRouter()


@router.get("/", response_model=list[RefundOut])
def list_refunds(
    refund_type: RefundType | None = None,
    booking_id: int | None = None,
    db: Session = Depends(get_db),
):
    return refund_crud.list_refunds(db, refund_type=refund_type, booking_id=booking_id)


@router.post("/", response_model=RefundOut, status_code=status.HTTP_201_CREATED)
def create_refund(refund_in: RefundCreate, db: Session = Depends(get_db)):
    try:
        return refund_crud.create_refund(db, refund_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{refund_id}", response_model=RefundOut)
def get_refund(refund_id: int, db: Session = Depends(get_db)):
    db_refund = refund_crud.get_refund(db, refund_id)
    if not db_refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    return db_refund


@router.put("/{refund_id}/deduction", response_model=RefundOut)
def update_deduction(refund_id: int, deduction_in: RefundDeductionUpdate, db: Session = Depends(get_db)):
    db_refund = refund_crud.get_refund(db, refund_id)
    if not db_refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    try:
        return refund_crud.update_deduction(db, db_refund, deduction_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post(
    "/{refund_id}/payments", response_model=RefundOut, status_code=status.HTTP_201_CREATED
)
def add_payment(refund_id: int, payment_in: RefundPaymentCreate, db: Session = Depends(get_db)):
    db_refund = refund_crud.get_refund(db, refund_id)
    if not db_refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    try:
        return refund_crud.add_payment(db, db_refund, payment_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/payments/{payment_id}", response_model=RefundOut)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    db_payment = refund_crud.get_payment(db, payment_id)
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return refund_crud.delete_payment(db, db_payment)


@router.delete("/{refund_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_refund(refund_id: int, db: Session = Depends(get_db)):
    db_refund = refund_crud.get_refund(db, refund_id)
    if not db_refund:
        raise HTTPException(status_code=404, detail="Refund not found")
    delete_with_fk_guard(db, lambda: refund_crud.delete_refund(db, db_refund), "refund")
