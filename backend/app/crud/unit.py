from sqlalchemy.orm import Session

from app.core.sequences import next_sequence_number
from app.models.booking import Booking
from app.models.project import ProjectFloor
from app.models.unit import Unit, UnitCategory
from app.schemas.unit import UnitBulkGenerate, UnitCategoryCreate, UnitCategoryUpdate, UnitCreate, UnitUpdate


def _next_unit_ref_no(db: Session) -> str:
    return next_sequence_number(db, Unit.unit_ref_no, "UNT-", 6)


def _next_unit_seq(db: Session) -> int:
    rows = db.query(Unit.unit_ref_no).filter(Unit.unit_ref_no.like("UNT-%")).all()
    max_n = 0
    for (value,) in rows:
        suffix = value[len("UNT-"):]
        if suffix.isdigit():
            max_n = max(max_n, int(suffix))
    return max_n + 1


def list_unit_categories(db: Session) -> list[UnitCategory]:
    return db.query(UnitCategory).all()


def get_unit_category(db: Session, category_id: int) -> UnitCategory | None:
    return db.query(UnitCategory).filter(UnitCategory.id == category_id).first()


def create_unit_category(db: Session, category_in: UnitCategoryCreate) -> UnitCategory:
    if db.query(UnitCategory).filter(UnitCategory.name == category_in.name).first():
        raise ValueError(f'A category named "{category_in.name}" already exists. Edit it instead.')
    db_category = UnitCategory(**category_in.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


def update_unit_category(
    db: Session, db_category: UnitCategory, category_in: UnitCategoryUpdate
) -> UnitCategory:
    updates = category_in.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != db_category.name:
        if db.query(UnitCategory).filter(UnitCategory.name == updates["name"]).first():
            raise ValueError(f'A category named "{updates["name"]}" already exists.')
    for field, value in updates.items():
        setattr(db_category, field, value)
    db.commit()
    db.refresh(db_category)
    return db_category


def delete_unit_category(db: Session, db_category: UnitCategory) -> None:
    units = db.query(Unit).filter(Unit.unit_category_id == db_category.id).all()
    if units:
        refs = ", ".join(u.unit_ref_no for u in units)
        raise ValueError(
            f"This category is used by {len(units)} unit(s): {refs}. "
            "Reassign or remove those units first (project's Units tab)."
        )
    db.delete(db_category)
    db.commit()


def list_units(
    db: Session,
    project_id: int | None = None,
    floor_id: int | None = None,
    status: str | None = None,
) -> list[Unit]:
    query = db.query(Unit)
    if project_id is not None:
        query = query.filter(Unit.project_id == project_id)
    if floor_id is not None:
        query = query.filter(Unit.floor_id == floor_id)
    if status is not None:
        query = query.filter(Unit.status == status)
    return query.all()


def get_unit(db: Session, unit_id: int) -> Unit | None:
    return db.query(Unit).filter(Unit.id == unit_id).first()


def create_unit(db: Session, project_id: int, unit_in: UnitCreate) -> Unit:
    total_price = unit_in.base_price + unit_in.extra_charges
    db_unit = Unit(
        unit_ref_no=_next_unit_ref_no(db),
        project_id=project_id,
        total_price=total_price,
        **unit_in.model_dump(exclude={"project_id"}),
    )
    db.add(db_unit)
    db.commit()
    db.refresh(db_unit)
    return db_unit


def update_unit(db: Session, db_unit: Unit, unit_in: UnitUpdate) -> Unit:
    data = unit_in.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(db_unit, field, value)
    db_unit.total_price = db_unit.base_price + db_unit.extra_charges
    db.commit()
    db.refresh(db_unit)
    return db_unit


def delete_unit(db: Session, db_unit: Unit) -> None:
    bookings = db.query(Booking).filter(Booking.unit_id == db_unit.id).all()
    if bookings:
        refs = ", ".join(b.booking_ref_no for b in bookings)
        raise ValueError(
            f"This unit has {len(bookings)} booking(s) that must be cancelled and "
            f"deleted first (Unit Booking tab): {refs}"
        )
    db.delete(db_unit)
    db.commit()


def bulk_generate_units(db: Session, project_id: int, payload: UnitBulkGenerate) -> list[Unit]:
    floor = db.query(ProjectFloor).filter(ProjectFloor.id == payload.floor_id).first()
    if floor is None:
        raise ValueError("Floor not found")

    existing = db.query(Unit).filter(Unit.floor_id == floor.id).count()
    remaining = floor.no_of_units - existing
    if remaining <= 0:
        raise ValueError(
            f"This floor's {floor.no_of_units} unit(s) are already generated. Delete some "
            "first if you want to regenerate."
        )

    quantity = payload.quantity if payload.quantity is not None else remaining
    if quantity <= 0:
        raise ValueError("Quantity must be at least 1.")
    if quantity > remaining:
        raise ValueError(f"Only {remaining} unit slot(s) left on this floor.")

    category = None
    if payload.unit_category_id is not None:
        category = (
            db.query(UnitCategory)
            .filter(UnitCategory.id == payload.unit_category_id)
            .first()
        )
    base_price = payload.base_price or (category.base_price if category else 0) or 0

    # Numbering continues on from whatever's already on this floor, so a
    # second batch (a different category) doesn't collide with the first.
    start_number = existing + 1
    created: list[Unit] = []
    next_seq = _next_unit_seq(db)
    for i in range(quantity):
        unit_number = f"{payload.prefix}{start_number + i}"
        db_unit = Unit(
            unit_ref_no=f"UNT-{next_seq:06d}",
            project_id=project_id,
            floor_id=floor.id,
            unit_category_id=payload.unit_category_id,
            unit_number=unit_number,
            base_price=base_price,
            extra_charges=0,
            total_price=base_price,
        )
        db.add(db_unit)
        created.append(db_unit)
        next_seq += 1

    db.commit()
    for unit in created:
        db.refresh(unit)
    return created
