from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import partner as partner_crud
from app.crud import project as project_crud
from app.db.session import get_db
from app.schemas.partner import ProjectPartnerShareCreate, ProjectPartnerShareOut
from app.schemas.project import (
    ProjectCreate,
    ProjectDetailOut,
    ProjectFloorCreate,
    ProjectFloorOut,
    ProjectGroupCreate,
    ProjectGroupOut,
    ProjectOut,
    ProjectUpdate,
)

router = APIRouter()


@router.get("/groups", response_model=list[ProjectGroupOut])
def list_project_groups(db: Session = Depends(get_db)):
    return project_crud.list_project_groups(db)


@router.post("/groups", response_model=ProjectGroupOut, status_code=status.HTTP_201_CREATED)
def create_project_group(group_in: ProjectGroupCreate, db: Session = Depends(get_db)):
    return project_crud.create_project_group(db, group_in)


@router.get("/", response_model=list[ProjectOut])
def list_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return project_crud.list_projects(db, skip=skip, limit=limit)


@router.post("/", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db)):
    return project_crud.create_project(db, project_in)


@router.get("/{project_id}", response_model=ProjectDetailOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    db_project = project_crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, project_in: ProjectUpdate, db: Session = Depends(get_db)):
    db_project = project_crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_crud.update_project(db, db_project, project_in)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_project = project_crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    delete_with_fk_guard(db, lambda: project_crud.delete_project(db, db_project), "project")


@router.get("/{project_id}/floors", response_model=list[ProjectFloorOut])
def list_floors(project_id: int, db: Session = Depends(get_db)):
    return project_crud.list_floors(db, project_id)


@router.post(
    "/{project_id}/floors",
    response_model=ProjectFloorOut,
    status_code=status.HTTP_201_CREATED,
)
def create_floor(project_id: int, floor_in: ProjectFloorCreate, db: Session = Depends(get_db)):
    db_project = project_crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_crud.create_floor(db, project_id, floor_in)


@router.delete("/floors/{floor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_floor(floor_id: int, db: Session = Depends(get_db)):
    db_floor = project_crud.get_floor(db, floor_id)
    if not db_floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    delete_with_fk_guard(db, lambda: project_crud.delete_floor(db, db_floor), "floor")


@router.get("/{project_id}/partner-shares", response_model=list[ProjectPartnerShareOut])
def list_partner_shares(project_id: int, db: Session = Depends(get_db)):
    return partner_crud.list_project_shares(db, project_id)


@router.post(
    "/{project_id}/partner-shares",
    response_model=ProjectPartnerShareOut,
    status_code=status.HTTP_201_CREATED,
)
def add_partner_share(
    project_id: int, share_in: ProjectPartnerShareCreate, db: Session = Depends(get_db)
):
    db_project = project_crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        return partner_crud.add_project_share(db, project_id, share_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/partner-shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partner_share(share_id: int, db: Session = Depends(get_db)):
    db_share = partner_crud.get_share(db, share_id)
    if not db_share:
        raise HTTPException(status_code=404, detail="Share not found")
    delete_with_fk_guard(db, lambda: partner_crud.delete_share(db, db_share), "partner share")
