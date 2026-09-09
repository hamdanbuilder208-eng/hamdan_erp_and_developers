from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.rental import RentAgreementStatus
from app.schemas.account import AccountOut
from app.schemas.land_property import LandPropertyOut
from app.schemas.unit import UnitOut


class TenantBase(BaseModel):
    name: str
    cnic: str | None = None
    mobile: str | None = None
    address: str | None = None


class TenantCreate(TenantBase):
    pass


class TenantOut(TenantBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    tenant_code: str


class RentScheduleLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    month_no: int
    due_date: date
    amount: float
    paid_amount: float


class RentAgreementBase(BaseModel):
    agreement_date: date
    tenant_id: int
    unit_id: int | None = None
    land_property_id: int | None = None
    monthly_rent: float
    security_deposit: float = 0
    start_date: date
    duration_months: int
    narration: str | None = None


class RentAgreementCreate(RentAgreementBase):
    @model_validator(mode="after")
    def validate_exactly_one_target(self):
        if bool(self.unit_id) == bool(self.land_property_id):
            raise ValueError("Choose either a unit or a property to rent out — not both, not neither")
        if self.duration_months <= 0:
            raise ValueError("Duration must be at least 1 month")
        if self.monthly_rent <= 0:
            raise ValueError("Monthly rent must be greater than zero")
        return self


class RentAgreementOut(RentAgreementBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agreement_no: str
    status: RentAgreementStatus
    tenant: TenantOut
    unit: UnitOut | None = None
    land_property: LandPropertyOut | None = None
    schedule_lines: list[RentScheduleLineOut]


class RentReceiptBase(BaseModel):
    receipt_date: date
    agreement_id: int
    credit_account_id: int
    amount: float
    mode_of_payment: str = "Cash"
    narration: str | None = None


class RentReceiptCreate(RentReceiptBase):
    pass


class RentReceiptOut(RentReceiptBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    receipt_no: str
    voucher_id: int | None
    credit_account: AccountOut
    agreement: RentAgreementOut
