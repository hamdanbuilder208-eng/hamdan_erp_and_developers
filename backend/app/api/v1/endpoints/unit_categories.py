from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import unit as unit_crud
from app.db.session import get_db
from app.schemas.unit import UnitCategoryCreate, UnitCategoryOut, UnitCategoryUpdate

router = APIRouter()


@router.get("/", response_model=list[UnitCategoryOut])
def list_unit_categories(db: Session = Depends(get_db)):
    return unit_crud.list_unit_categories(db)


@router.post("/", response_model=UnitCategoryOut, status_code=status.HTTP_201_CREATED)
def create_unit_category(category_in: UnitCategoryCreate, db: Session = Depends(get_db)):
    try:
        return unit_crud.create_unit_category(db, category_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/{category_id}", response_model=UnitCategoryOut)
def update_unit_category(category_id: int, category_in: UnitCategoryUpdate, db: Session = Depends(get_db)):
    db_category = unit_crud.get_unit_category(db, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    try:
        return unit_crud.update_unit_category(db, db_category, category_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit_category(category_id: int, db: Session = Depends(get_db)):
    db_category = unit_crud.get_unit_category(db, category_id)
    if not db_category:
        raise HTTPException(status_code=404, detail="Category not found")
    delete_with_fk_guard(db, lambda: unit_crud.delete_unit_category(db, db_category), "category")
