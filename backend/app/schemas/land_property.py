from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.booking import PaymentMode
from app.models.land_property import (
    LandPropertyPaymentDirection,
    LandPropertyStatus,
    PropertyType,
    SizeUnit,
)


class LandPropertyBase(BaseModel):
    property_type: PropertyType
    area_location: str
    size_number: float = 0
    size_unit: SizeUnit = SizeUnit.SQ_YD
    owner_vendor: str | None = None
    purchase_rate: float | None = None
    sale_rate: float | None = None
    status: LandPropertyStatus = LandPropertyStatus.AVAILABLE
    seller_payment_due_date: date | None = None
    buyer_payment_due_date: date | None = None
    remarks: str | None = None


class LandPropertyCreate(LandPropertyBase):
    pass


class LandPropertyUpdate(BaseModel):
    property_type: PropertyType | None = None
    area_location: str | None = None
    size_number: float | None = None
    size_unit: SizeUnit | None = None
    owner_vendor: str | None = None
    purchase_rate: float | None = None
    sale_rate: float | None = None
    status: LandPropertyStatus | None = None
    seller_payment_due_date: date | None = None
    buyer_payment_due_date: date | None = None
    remarks: str | None = None


class LandPropertyPaymentBase(BaseModel):
    direction: LandPropertyPaymentDirection
    amount: float
    payment_date: date
    mode_of_payment: PaymentMode = PaymentMode.CASH
    narration: str | None = None


class LandPropertyPaymentCreate(LandPropertyPaymentBase):
    pass


class LandPropertyPaymentOut(LandPropertyPaymentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    land_property_id: int


class LandPropertyOut(LandPropertyBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    property_ref_no: str
    payments: list[LandPropertyPaymentOut] = []
