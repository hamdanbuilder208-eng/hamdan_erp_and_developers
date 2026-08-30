from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import partner as partner_crud
from app.db.session import get_db
from app.schemas.partner import PartnerCreate, PartnerOut, PartnerSummary, PartnerUpdate

router = APIRouter()


@router.get("/", response_model=list[PartnerOut])
def list_partners(db: Session = Depends(get_db)):
    return partner_crud.list_partners(db)


@router.post("/", response_model=PartnerOut, status_code=status.HTTP_201_CREATED)
def create_partner(partner_in: PartnerCreate, db: Session = Depends(get_db)):
    return partner_crud.create_partner(db, partner_in)


@router.get("/{partner_id}", response_model=PartnerOut)
def get_partner(partner_id: int, db: Session = Depends(get_db)):
    db_partner = partner_crud.get_partner(db, partner_id)
    if not db_partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return db_partner


@router.get("/{partner_id}/summary", response_model=PartnerSummary)
def get_partner_summary(partner_id: int, db: Session = Depends(get_db)):
    summary = partner_crud.get_partner_summary(db, partner_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Partner not found")
    return summary


@router.put("/{partner_id}", response_model=PartnerOut)
def update_partner(partner_id: int, partner_in: PartnerUpdate, db: Session = Depends(get_db)):
    db_partner = partner_crud.get_partner(db, partner_id)
    if not db_partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    return partner_crud.update_partner(db, db_partner, partner_in)


@router.delete("/{partner_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partner(partner_id: int, db: Session = Depends(get_db)):
    db_partner = partner_crud.get_partner(db, partner_id)
    if not db_partner:
        raise HTTPException(status_code=404, detail="Partner not found")
    delete_with_fk_guard(db, lambda: partner_crud.delete_partner(db, db_partner), "partner")
