from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import partner_drawing as drawing_crud
from app.db.session import get_db
from app.schemas.partner import PartnerDrawingCreate, PartnerDrawingOut

router = APIRouter()


@router.get("/", response_model=list[PartnerDrawingOut])
def list_drawings(
    partner_id: int | None = None,
    project_id: int | None = None,
    db: Session = Depends(get_db),
):
    return drawing_crud.list_drawings(db, partner_id=partner_id, project_id=project_id)


@router.post("/", response_model=PartnerDrawingOut, status_code=status.HTTP_201_CREATED)
def create_drawing(drawing_in: PartnerDrawingCreate, db: Session = Depends(get_db)):
    try:
        return drawing_crud.create_drawing(db, drawing_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{drawing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_drawing(drawing_id: int, db: Session = Depends(get_db)):
    db_drawing = drawing_crud.get_drawing(db, drawing_id)
    if not db_drawing:
        raise HTTPException(status_code=404, detail="Drawing not found")
    drawing_crud.delete_drawing(db, db_drawing)
