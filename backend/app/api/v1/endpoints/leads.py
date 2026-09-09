from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.crud import lead as lead_crud
from app.db.session import get_db
from app.schemas.lead import LeadCreate, LeadImportResult, LeadOut

router = APIRouter()

MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.get("/", response_model=list[LeadOut])
def list_leads(db: Session = Depends(get_db)):
    return lead_crud.list_leads(db)


@router.post("/", response_model=LeadOut, status_code=status.HTTP_201_CREATED)
def create_lead(lead_in: LeadCreate, db: Session = Depends(get_db)):
    return lead_crud.create_lead(db, lead_in)


@router.post("/import", response_model=LeadImportResult)
async def import_leads(file: UploadFile, db: Session = Depends(get_db)):
    if not (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Please upload an Excel (.xlsx) file")

    contents = await file.read()
    if len(contents) > MAX_IMPORT_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File must be under 5MB")

    try:
        return lead_crud.import_leads_from_excel(db, contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    db_lead = lead_crud.get_lead(db, lead_id)
    if not db_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead_crud.delete_lead(db, db_lead)
