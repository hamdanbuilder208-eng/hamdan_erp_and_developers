from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import project as project_crud
from app.crud import unit as unit_crud
from app.db.session import get_db
from app.models.unit import UnitStatus
from app.schemas.unit import UnitBulkGenerate, UnitCreate, UnitOut, UnitUpdate

router = APIRouter()


@router.get("/", response_model=list[UnitOut])
def list_units(
    project_id: int | None = None,
    floor_id: int | None = None,
    status_filter: UnitStatus | None = None,
    db: Session = Depends(get_db),
):
    return unit_crud.list_units(db, project_id=project_id, floor_id=floor_id, status=status_filter)


@router.post("/", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(unit_in: UnitCreate, db: Session = Depends(get_db)):
    db_project = project_crud.get_project(db, unit_in.project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return unit_crud.create_unit(db, unit_in.project_id, unit_in)


@router.post(
    "/bulk-generate/{project_id}",
    response_model=list[UnitOut],
    status_code=status.HTTP_201_CREATED,
)
def bulk_generate_units(project_id: int, payload: UnitBulkGenerate, db: Session = Depends(get_db)):
    db_project = project_crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        return unit_crud.bulk_generate_units(db, project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.put("/{unit_id}", response_model=UnitOut)
def update_unit(unit_id: int, unit_in: UnitUpdate, db: Session = Depends(get_db)):
    db_unit = unit_crud.get_unit(db, unit_id)
    if not db_unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    return unit_crud.update_unit(db, db_unit, unit_in)


@router.delete("/{unit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_unit(unit_id: int, db: Session = Depends(get_db)):
    db_unit = unit_crud.get_unit(db, unit_id)
    if not db_unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    delete_with_fk_guard(db, lambda: unit_crud.delete_unit(db, db_unit), "unit")
