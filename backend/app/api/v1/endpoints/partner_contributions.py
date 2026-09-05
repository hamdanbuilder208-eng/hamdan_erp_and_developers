from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import partner_contribution as contribution_crud
from app.db.session import get_db
from app.schemas.partner import PartnerContributionCreate, PartnerContributionOut

router = APIRouter()


@router.get("/", response_model=list[PartnerContributionOut])
def list_contributions(
    partner_id: int | None = None,
    project_id: int | None = None,
    db: Session = Depends(get_db),
):
    return contribution_crud.list_contributions(db, partner_id=partner_id, project_id=project_id)


@router.post("/", response_model=PartnerContributionOut, status_code=status.HTTP_201_CREATED)
def create_contribution(contribution_in: PartnerContributionCreate, db: Session = Depends(get_db)):
    try:
        return contribution_crud.create_contribution(db, contribution_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{contribution_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contribution(contribution_id: int, db: Session = Depends(get_db)):
    db_contribution = contribution_crud.get_contribution(db, contribution_id)
    if not db_contribution:
        raise HTTPException(status_code=404, detail="Contribution not found")
    contribution_crud.delete_contribution(db, db_contribution)
