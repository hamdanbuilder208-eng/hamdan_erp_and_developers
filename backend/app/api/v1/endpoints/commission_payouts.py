from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import commission_payout as payout_crud
from app.db.session import get_db
from app.schemas.commission_payout import CommissionPayoutCreate, CommissionPayoutOut

router = APIRouter()


@router.get("/", response_model=list[CommissionPayoutOut])
def list_payouts(
    agent_id: int | None = None,
    booking_id: int | None = None,
    db: Session = Depends(get_db),
):
    return payout_crud.list_payouts(db, agent_id=agent_id, booking_id=booking_id)


@router.post("/", response_model=CommissionPayoutOut, status_code=status.HTTP_201_CREATED)
def create_payout(payout_in: CommissionPayoutCreate, db: Session = Depends(get_db)):
    try:
        return payout_crud.create_payout(db, payout_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/{payout_id}", response_model=CommissionPayoutOut)
def get_payout(payout_id: int, db: Session = Depends(get_db)):
    db_payout = payout_crud.get_payout(db, payout_id)
    if not db_payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    return db_payout


@router.delete("/{payout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payout(payout_id: int, db: Session = Depends(get_db)):
    db_payout = payout_crud.get_payout(db, payout_id)
    if not db_payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    delete_with_fk_guard(db, lambda: payout_crud.delete_payout(db, db_payout), "commission payout")
