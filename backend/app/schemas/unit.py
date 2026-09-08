from pydantic import BaseModel, ConfigDict

from app.models.unit import UnitStatus


class UnitCategoryBase(BaseModel):
    name: str
    description: str | None = None
    base_price: float | None = 0


class UnitCategoryCreate(UnitCategoryBase):
    pass


class UnitCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    base_price: float | None = None


class UnitCategoryOut(UnitCategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class UnitBase(BaseModel):
    unit_number: str
    project_id: int
    floor_id: int | None = None
    unit_category_id: int | None = None
    facility_1: str | None = None
    facility_2: str | None = None
    facility_3: str | None = None
    facility_4: str | None = None
    extra_charges: float = 0
    base_price: float = 0
    status: UnitStatus = UnitStatus.AVAILABLE
    picture_url: str | None = None


class UnitCreate(UnitBase):
    pass


class UnitUpdate(BaseModel):
    unit_number: str | None = None
    floor_id: int | None = None
    unit_category_id: int | None = None
    facility_1: str | None = None
    facility_2: str | None = None
    facility_3: str | None = None
    facility_4: str | None = None
    extra_charges: float | None = None
    base_price: float | None = None
    status: UnitStatus | None = None
    picture_url: str | None = None


class UnitOut(UnitBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    unit_ref_no: str
    total_price: float
    unit_category: UnitCategoryOut | None = None


class UnitBulkGenerate(BaseModel):
    floor_id: int
    unit_category_id: int | None = None
    # How many units to create in this batch. Omit to fill the floor's
    # remaining, ungenerated slots — lets a floor be built up from several
    # batches, each with its own category (e.g. 2x "2 Bed" + 1x "3 Bed").
    quantity: int | None = None
    prefix: str = ""
    base_price: float = 0
