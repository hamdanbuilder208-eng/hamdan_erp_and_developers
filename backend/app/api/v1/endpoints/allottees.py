from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import allottee as allottee_crud
from app.db.session import get_db
from app.schemas.allottee import AllotteeCreate, AllotteeOut, AllotteeUpdate

router = APIRouter()


@router.get("/", response_model=list[AllotteeOut])
def list_allottees(search: str | None = None, db: Session = Depends(get_db)):
    return allottee_crud.list_allottees(db, search=search)


@router.post("/", response_model=AllotteeOut, status_code=status.HTTP_201_CREATED)
def create_allottee(allottee_in: AllotteeCreate, db: Session = Depends(get_db)):
    return allottee_crud.create_allottee(db, allottee_in)


@router.get("/{allottee_id}", response_model=AllotteeOut)
def get_allottee(allottee_id: int, db: Session = Depends(get_db)):
    db_allottee = allottee_crud.get_allottee(db, allottee_id)
    if not db_allottee:
        raise HTTPException(status_code=404, detail="Allottee not found")
    return db_allottee


@router.put("/{allottee_id}", response_model=AllotteeOut)
def update_allottee(allottee_id: int, allottee_in: AllotteeUpdate, db: Session = Depends(get_db)):
    db_allottee = allottee_crud.get_allottee(db, allottee_id)
    if not db_allottee:
        raise HTTPException(status_code=404, detail="Allottee not found")
    return allottee_crud.update_allottee(db, db_allottee, allottee_in)


@router.delete("/{allottee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_allottee(allottee_id: int, db: Session = Depends(get_db)):
    db_allottee = allottee_crud.get_allottee(db, allottee_id)
    if not db_allottee:
        raise HTTPException(status_code=404, detail="Allottee not found")
    delete_with_fk_guard(db, lambda: allottee_crud.delete_allottee(db, db_allottee), "allottee")
