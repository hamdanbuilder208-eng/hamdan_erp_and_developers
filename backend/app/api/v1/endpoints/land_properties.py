from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import land_property as land_crud
from app.db.session import get_db
from app.models.land_property import LandPropertyStatus, PropertyType
from app.schemas.land_property import LandPropertyCreate, LandPropertyOut, LandPropertyUpdate

router = APIRouter()


@router.get("/", response_model=list[LandPropertyOut])
def list_land_properties(
    property_type: PropertyType | None = None,
    status_filter: LandPropertyStatus | None = None,
    area_location: str | None = None,
    db: Session = Depends(get_db),
):
    return land_crud.list_land_properties(
        db, property_type=property_type, status=status_filter, area_location=area_location
    )


@router.post("/", response_model=LandPropertyOut, status_code=status.HTTP_201_CREATED)
def create_land_property(property_in: LandPropertyCreate, db: Session = Depends(get_db)):
    return land_crud.create_land_property(db, property_in)


@router.put("/{property_id}", response_model=LandPropertyOut)
def update_land_property(
    property_id: int, property_in: LandPropertyUpdate, db: Session = Depends(get_db)
):
    db_property = land_crud.get_land_property(db, property_id)
    if not db_property:
        raise HTTPException(status_code=404, detail="Property not found")
    return land_crud.update_land_property(db, db_property, property_in)


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_land_property(property_id: int, db: Session = Depends(get_db)):
    db_property = land_crud.get_land_property(db, property_id)
    if not db_property:
        raise HTTPException(status_code=404, detail="Property not found")
    delete_with_fk_guard(db, lambda: land_crud.delete_land_property(db, db_property), "property")
