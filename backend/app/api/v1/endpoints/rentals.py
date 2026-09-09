from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import rent_receipt as rent_receipt_crud
from app.crud import rental as rental_crud
from app.db.session import get_db
from app.schemas.rental import (
    RentAgreementCreate,
    RentAgreementOut,
    RentReceiptCreate,
    RentReceiptOut,
    TenantCreate,
    TenantOut,
)

router = APIRouter()


# Tenants


@router.get("/tenants", response_model=list[TenantOut])
def list_tenants(db: Session = Depends(get_db)):
    return rental_crud.list_tenants(db)


@router.post("/tenants", response_model=TenantOut, status_code=status.HTTP_201_CREATED)
def create_tenant(tenant_in: TenantCreate, db: Session = Depends(get_db)):
    return rental_crud.create_tenant(db, tenant_in)


@router.delete("/tenants/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: int, db: Session = Depends(get_db)):
    db_tenant = rental_crud.get_tenant(db, tenant_id)
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    delete_with_fk_guard(db, lambda: rental_crud.delete_tenant(db, db_tenant), "tenant")


# Rent Agreements


@router.get("/agreements", response_model=list[RentAgreementOut])
def list_agreements(status_filter: str | None = None, db: Session = Depends(get_db)):
    return rental_crud.list_agreements(db, status=status_filter)


@router.post("/agreements", response_model=RentAgreementOut, status_code=status.HTTP_201_CREATED)
def create_agreement(agreement_in: RentAgreementCreate, db: Session = Depends(get_db)):
    try:
        return rental_crud.create_agreement(db, agreement_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/agreements/{agreement_id}", response_model=RentAgreementOut)
def get_agreement(agreement_id: int, db: Session = Depends(get_db)):
    db_agreement = rental_crud.get_agreement(db, agreement_id)
    if not db_agreement:
        raise HTTPException(status_code=404, detail="Rent agreement not found")
    return db_agreement


@router.post("/agreements/{agreement_id}/terminate", response_model=RentAgreementOut)
def terminate_agreement(agreement_id: int, end_date: date, db: Session = Depends(get_db)):
    db_agreement = rental_crud.get_agreement(db, agreement_id)
    if not db_agreement:
        raise HTTPException(status_code=404, detail="Rent agreement not found")
    try:
        return rental_crud.terminate_agreement(db, db_agreement, end_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/agreements/{agreement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agreement(agreement_id: int, db: Session = Depends(get_db)):
    db_agreement = rental_crud.get_agreement(db, agreement_id)
    if not db_agreement:
        raise HTTPException(status_code=404, detail="Rent agreement not found")
    delete_with_fk_guard(db, lambda: rental_crud.delete_agreement(db, db_agreement), "rent agreement")


# Rent Receipts


@router.get("/receipts", response_model=list[RentReceiptOut])
def list_receipts(agreement_id: int | None = None, db: Session = Depends(get_db)):
    return rent_receipt_crud.list_receipts(db, agreement_id=agreement_id)


@router.post("/receipts", response_model=RentReceiptOut, status_code=status.HTTP_201_CREATED)
def create_receipt(receipt_in: RentReceiptCreate, db: Session = Depends(get_db)):
    try:
        return rent_receipt_crud.create_receipt(db, receipt_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/receipts/{receipt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    db_receipt = rent_receipt_crud.get_receipt(db, receipt_id)
    if not db_receipt:
        raise HTTPException(status_code=404, detail="Rent receipt not found")
    delete_with_fk_guard(db, lambda: rent_receipt_crud.delete_receipt(db, db_receipt), "rent receipt")
