from sqlalchemy.orm import Session

from app.core.sequences import next_sequence_number
from app.models.booking import Booking
from app.models.project import Project, ProjectFloor, ProjectGroup
from app.models.unit import Unit
from app.schemas.project import (
    ProjectCreate,
    ProjectFloorCreate,
    ProjectGroupCreate,
    ProjectUpdate,
)


def _next_project_code(db: Session) -> str:
    return next_sequence_number(db, Project.project_code, "PRJ-", 4)


def list_projects(db: Session, skip: int = 0, limit: int = 100) -> list[Project]:
    return db.query(Project).offset(skip).limit(limit).all()


def get_project(db: Session, project_id: int) -> Project | None:
    return db.query(Project).filter(Project.id == project_id).first()


def create_project(db: Session, project_in: ProjectCreate) -> Project:
    db_project = Project(
        project_code=_next_project_code(db),
        **project_in.model_dump(),
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


def update_project(db: Session, db_project: Project, project_in: ProjectUpdate) -> Project:
    for field, value in project_in.model_dump(exclude_unset=True).items():
        setattr(db_project, field, value)
    db.commit()
    db.refresh(db_project)
    return db_project


def delete_project(db: Session, db_project: Project) -> None:
    bookings = db.query(Booking).filter(Booking.project_id == db_project.id).all()
    if bookings:
        refs = ", ".join(b.booking_ref_no for b in bookings)
        raise ValueError(
            f"This project has {len(bookings)} booking(s) that must be cancelled and "
            f"deleted first: {refs}"
        )
    db.delete(db_project)
    db.commit()


# Project Groups

def list_project_groups(db: Session) -> list[ProjectGroup]:
    return db.query(ProjectGroup).all()


def create_project_group(db: Session, group_in: ProjectGroupCreate) -> ProjectGroup:
    db_group = ProjectGroup(**group_in.model_dump())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


# Floors

def list_floors(db: Session, project_id: int) -> list[ProjectFloor]:
    return db.query(ProjectFloor).filter(ProjectFloor.project_id == project_id).all()


def get_floor(db: Session, floor_id: int) -> ProjectFloor | None:
    return db.query(ProjectFloor).filter(ProjectFloor.id == floor_id).first()


def create_floor(db: Session, project_id: int, floor_in: ProjectFloorCreate) -> ProjectFloor:
    db_floor = ProjectFloor(project_id=project_id, **floor_in.model_dump())
    db.add(db_floor)
    db.commit()
    db.refresh(db_floor)
    return db_floor


def delete_floor(db: Session, db_floor: ProjectFloor) -> None:
    units = db.query(Unit).filter(Unit.floor_id == db_floor.id).all()
    if units:
        refs = ", ".join(u.unit_number for u in units)
        raise ValueError(
            f"This floor has {len(units)} unit(s) that must be removed first: {refs}"
        )
    db.delete(db_floor)
    db.commit()
