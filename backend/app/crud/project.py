from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.sequences import next_sequence_number
from app.models.booking import Booking
from app.models.expense import OfficeExpense
from app.models.inventory import GRN
from app.models.petty_cash import PettyCashExpense
from app.models.project import (
    Project,
    ProjectFloor,
    ProjectGroup,
    ProjectPaymentTemplate,
    ProjectPaymentTemplateLine,
)
from app.models.unit import Unit
from app.schemas.project import (
    ProjectCreate,
    ProjectFloorCreate,
    ProjectGroupCreate,
    ProjectUpdate,
    PaymentTemplateUpsert,
)


def _next_project_code(db: Session) -> str:
    return next_sequence_number(db, Project.project_code, "PRJ-", 4)


def list_projects(db: Session, skip: int = 0, limit: int = 100) -> list[Project]:
    return db.query(Project).offset(skip).limit(limit).all()


def project_total_spent(db: Session, project_id: int) -> float:
    """Everything actually spent against this project's construction budget —
    material bought (GRN), office expenses, and petty cash expenses tagged to
    it. Wages aren't included: WagePayment has no project link yet."""
    grn_total = (
        db.query(func.coalesce(func.sum(GRN.total_amount), 0))
        .filter(GRN.project_id == project_id)
        .scalar()
    )
    office_total = (
        db.query(func.coalesce(func.sum(OfficeExpense.amount), 0))
        .filter(OfficeExpense.project_id == project_id)
        .scalar()
    )
    petty_cash_total = (
        db.query(func.coalesce(func.sum(PettyCashExpense.amount), 0))
        .filter(PettyCashExpense.project_id == project_id)
        .scalar()
    )
    return float(grn_total) + float(office_total) + float(petty_cash_total)


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
            f"deleted first (Unit Booking tab): {refs}"
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
            f"This floor has {len(units)} unit(s) that must be removed first "
            f"(project's Units tab): {refs}"
        )
    db.delete(db_floor)
    db.commit()


# Payment Template


def get_payment_template(db: Session, project_id: int) -> ProjectPaymentTemplate | None:
    return (
        db.query(ProjectPaymentTemplate)
        .filter(ProjectPaymentTemplate.project_id == project_id)
        .first()
    )


def upsert_payment_template(
    db: Session, project_id: int, template_in: PaymentTemplateUpsert
) -> ProjectPaymentTemplate:
    template = get_payment_template(db, project_id)
    if template:
        db.query(ProjectPaymentTemplateLine).filter(
            ProjectPaymentTemplateLine.template_id == template.id
        ).delete()
        template.booking_percent = template_in.booking_percent
    else:
        template = ProjectPaymentTemplate(project_id=project_id, booking_percent=template_in.booking_percent)
        db.add(template)
    db.flush()

    for line_in in template_in.lines:
        db.add(ProjectPaymentTemplateLine(template_id=template.id, **line_in.model_dump()))

    db.commit()
    db.refresh(template)
    return template
