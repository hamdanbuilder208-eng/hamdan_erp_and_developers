import re
from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.models.receipt import ChequeStatus
from app.models.rental import RentAgreementStatus, RentReceiptType
from app.schemas.account import AccountOut
from app.schemas.allottee import _clean_cnic, _clean_phone
from app.schemas.land_property import LandPropertyOut
from app.schemas.payment_details import PaymentDetailsFields
from app.schemas.unit import UnitOut


class TenantBase(BaseModel):
    name: str
    cnic: str | None = None
    mobile: str | None = None
    address: str | None = None


class TenantCreate(TenantBase):
    # Same checks as an allottee's CNIC and phone numbers. Only on input, so
    # tenants saved before these checks existed still load.
    @field_validator("cnic")
    @classmethod
    def _v_cnic(cls, v: str | None) -> str | None:
        return _clean_cnic(v, "CNIC")

    @field_validator("mobile")
    @classmethod
    def _v_mobile(cls, v: str | None) -> str | None:
        v = _clean_phone(v, "Mobile")
        if v and len(re.sub(r"\D", "", v)) < 10:
            raise ValueError("Mobile number looks incomplete (e.g. 0300-1234567)")
        return v


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


class RentAgreementRenew(BaseModel):
    """New term for an existing agreement — tenant and unit/property carry over."""

    agreement_date: date
    start_date: date
    monthly_rent: float
    duration_months: int
    security_deposit: float = 0
    narration: str | None = None

    @model_validator(mode="after")
    def validate_terms(self):
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


class RentReceiptBase(PaymentDetailsFields):
    receipt_date: date
    receipt_type: RentReceiptType = RentReceiptType.RENT
    agreement_id: int
    credit_account_id: int
    amount: float
    mode_of_payment: str = "Cash"
    cheque_date: date | None = None
    # When the cheque can be cashed — drives the dashboard reminder.
    cheque_clearing_date: date | None = None
    narration: str | None = None


class RentReceiptCreate(RentReceiptBase):
    @model_validator(mode="after")
    def validate_amount(self):
        if self.amount <= 0:
            raise ValueError("Amount must be greater than zero")
        return self


class RentReceiptOut(RentReceiptBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    receipt_no: str
    voucher_id: int | None
    cheque_status: ChequeStatus | None = None
    credit_account: AccountOut
    agreement: RentAgreementOut


class RentReceiptPrintOut(RentReceiptOut):
    # schedule_line_id -> amount paid on it as of this receipt.
    line_paid_as_of: dict[int, float] = {}
