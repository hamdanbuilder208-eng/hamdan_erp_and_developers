from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.errors import delete_with_fk_guard
from app.crud import partner as partner_crud
from app.crud import project as project_crud
from app.db.session import get_db
from app.models.unit import UnitCategory
from app.models.user import User
from app.schemas.partner import ProjectPartnerShareCreate, ProjectPartnerShareOut
from app.schemas.project import (
    PaymentTemplateOut,
    PaymentTemplateUpsert,
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
    db_project.total_spent = project_crud.project_total_spent(db, project_id)
    return db_project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_project = project_crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    # Only admins may edit a project after it is created.
    if not current_user.role.is_admin:
        raise HTTPException(status_code=403, detail="Only an admin can edit project details")
    try:
        return project_crud.update_project(db, db_project, project_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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


@router.get("/{project_id}/payment-templates", response_model=list[PaymentTemplateOut])
def list_payment_templates(project_id: int, db: Session = Depends(get_db)):
    return project_crud.list_payment_templates(db, project_id)


# unit_category_id omitted = the project's default plan. With fallback=true
# (used by New Booking) a category without its own plan gets the default.
@router.get("/{project_id}/payment-template", response_model=PaymentTemplateOut | None)
def get_payment_template(
    project_id: int,
    unit_category_id: int | None = None,
    fallback: bool = False,
    db: Session = Depends(get_db),
):
    return project_crud.get_payment_template(db, project_id, unit_category_id, fallback)


@router.put("/{project_id}/payment-template", response_model=PaymentTemplateOut)
def upsert_payment_template(
    project_id: int,
    template_in: PaymentTemplateUpsert,
    unit_category_id: int | None = None,
    db: Session = Depends(get_db),
):
    db_project = project_crud.get_project(db, project_id)
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    if unit_category_id is not None and not db.get(UnitCategory, unit_category_id):
        raise HTTPException(status_code=404, detail="Unit category not found")
    try:
        return project_crud.upsert_payment_template(db, project_id, template_in, unit_category_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{project_id}/payment-template", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment_template(
    project_id: int, unit_category_id: int | None = None, db: Session = Depends(get_db)
):
    template = project_crud.get_payment_template(db, project_id, unit_category_id)
    if not template:
        raise HTTPException(status_code=404, detail="Payment plan not found")
    project_crud.delete_payment_template(db, template)


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
