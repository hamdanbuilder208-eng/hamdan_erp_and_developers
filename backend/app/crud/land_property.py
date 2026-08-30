from sqlalchemy.orm import Session

from app.core.sequences import next_sequence_number
from app.models.land_property import LandProperty
from app.schemas.land_property import LandPropertyCreate, LandPropertyUpdate


def _next_property_ref_no(db: Session) -> str:
    return next_sequence_number(db, LandProperty.property_ref_no, "LND-", 5)


def list_land_properties(
    db: Session,
    property_type: str | None = None,
    status: str | None = None,
    area_location: str | None = None,
) -> list[LandProperty]:
    query = db.query(LandProperty)
    if property_type is not None:
        query = query.filter(LandProperty.property_type == property_type)
    if status is not None:
        query = query.filter(LandProperty.status == status)
    if area_location is not None:
        query = query.filter(LandProperty.area_location.ilike(f"%{area_location}%"))
    return query.order_by(LandProperty.id.desc()).all()


def get_land_property(db: Session, property_id: int) -> LandProperty | None:
    return db.query(LandProperty).filter(LandProperty.id == property_id).first()


def create_land_property(db: Session, property_in: LandPropertyCreate) -> LandProperty:
    db_property = LandProperty(
        property_ref_no=_next_property_ref_no(db),
        **property_in.model_dump(),
    )
    db.add(db_property)
    db.commit()
    db.refresh(db_property)
    return db_property


def update_land_property(
    db: Session, db_property: LandProperty, property_in: LandPropertyUpdate
) -> LandProperty:
    for field, value in property_in.model_dump(exclude_unset=True).items():
        setattr(db_property, field, value)
    db.commit()
    db.refresh(db_property)
    return db_property


def delete_land_property(db: Session, db_property: LandProperty) -> None:
    db.delete(db_property)
    db.commit()
