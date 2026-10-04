from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import contractor as contractor_crud
from app.db.session import get_db
from app.schemas.contractor import (
    ContractAgreementCreate,
    ContractAgreementDetailOut,
    ContractAgreementOut,
    ContractAgreementUpdate,
    ContractorBillCreate,
    ContractorBillOut,
    ContractorCreate,
    ContractorOut,
    ContractorPaymentCreate,
    ContractorPaymentDetailOut,
    ContractorSummaryOut,
    ContractorUpdate,
)

router = APIRouter()


def _agreement_or_404(db: Session, agreement_id: int):
    agreement = contractor_crud.get_agreement(db, agreement_id)
    if not agreement:
        raise HTTPException(status_code=404, detail="Agreement not found")
    return agreement


# Agreements (declared before /{contractor_id} so the paths don't collide)


@router.get("/agreements", response_model=list[ContractAgreementOut])
def list_agreements(
    project_id: int | None = None, contractor_id: int | None = None, db: Session = Depends(get_db)
):
    return contractor_crud.list_agreements(db, project_id=project_id, contractor_id=contractor_id)


@router.post("/agreements", response_model=ContractAgreementOut, status_code=status.HTTP_201_CREATED)
def create_agreement(agreement_in: ContractAgreementCreate, db: Session = Depends(get_db)):
    return contractor_crud.create_agreement(db, agreement_in)


@router.get("/agreements/{agreement_id}", response_model=ContractAgreementDetailOut)
def get_agreement(agreement_id: int, db: Session = Depends(get_db)):
    return _agreement_or_404(db, agreement_id)


@router.put("/agreements/{agreement_id}", response_model=ContractAgreementOut)
def update_agreement(agreement_id: int, agreement_in: ContractAgreementUpdate, db: Session = Depends(get_db)):
    return contractor_crud.update_agreement(db, _agreement_or_404(db, agreement_id), agreement_in)


@router.delete("/agreements/{agreement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_agreement(agreement_id: int, db: Session = Depends(get_db)):
    agreement = _agreement_or_404(db, agreement_id)
    delete_with_fk_guard(db, lambda: contractor_crud.delete_agreement(db, agreement), "agreement")


@router.post(
    "/agreements/{agreement_id}/bills", response_model=ContractorBillOut, status_code=status.HTTP_201_CREATED
)
def add_bill(agreement_id: int, bill_in: ContractorBillCreate, db: Session = Depends(get_db)):
    return contractor_crud.add_bill(db, _agreement_or_404(db, agreement_id), bill_in)


@router.delete("/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = contractor_crud.get_bill(db, bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    delete_with_fk_guard(db, lambda: contractor_crud.delete_bill(db, bill), "bill")


@router.post(
    "/agreements/{agreement_id}/payments",
    response_model=ContractorPaymentDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def add_payment(agreement_id: int, payment_in: ContractorPaymentCreate, db: Session = Depends(get_db)):
    return contractor_crud.add_payment(db, _agreement_or_404(db, agreement_id), payment_in)


@router.get("/payments/{payment_id}", response_model=ContractorPaymentDetailOut)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = contractor_crud.get_payment(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = contractor_crud.get_payment(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    delete_with_fk_guard(db, lambda: contractor_crud.delete_payment(db, payment), "payment")


# Contractors


@router.get("/", response_model=list[ContractorSummaryOut])
def list_contractors(db: Session = Depends(get_db)):
    return contractor_crud.list_contractors(db)


@router.post("/", response_model=ContractorOut, status_code=status.HTTP_201_CREATED)
def create_contractor(contractor_in: ContractorCreate, db: Session = Depends(get_db)):
    return contractor_crud.create_contractor(db, contractor_in)


@router.put("/{contractor_id}", response_model=ContractorOut)
def update_contractor(contractor_id: int, contractor_in: ContractorUpdate, db: Session = Depends(get_db)):
    contractor = contractor_crud.get_contractor(db, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return contractor_crud.update_contractor(db, contractor, contractor_in)


@router.delete("/{contractor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contractor(contractor_id: int, db: Session = Depends(get_db)):
    contractor = contractor_crud.get_contractor(db, contractor_id)
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    delete_with_fk_guard(db, lambda: contractor_crud.delete_contractor(db, contractor), "contractor")
