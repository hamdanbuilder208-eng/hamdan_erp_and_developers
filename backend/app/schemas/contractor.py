from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.contractor import ContractBasis, ContractorPaymentPurpose, ContractStatus
from app.schemas.account import AccountOut
from app.schemas.allottee import _clean_cnic
from app.schemas.payment_details import PaymentModeFields


# Contractor


class ContractorBase(BaseModel):
    name: str = Field(min_length=1)
    cnic: str
    ntn: str | None = None
    trade: str = Field(min_length=1)
    phone: str | None = None
    bank_name: str | None = None
    account_iban: str | None = None
    is_active: bool = True

    @field_validator("phone")
    @classmethod
    def _v_phone(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        digits = v.strip()
        if not (digits.isdigit() and len(digits) == 11):
            raise ValueError("Phone number must be exactly 11 digits (e.g. 03001234567)")
        return digits

    @field_validator("cnic")
    @classmethod
    def _v_cnic(cls, v: str) -> str:
        cleaned = _clean_cnic(v, "CNIC")
        if not cleaned:
            raise ValueError("CNIC is required")
        return cleaned


class ContractorCreate(ContractorBase):
    pass


class ContractorUpdate(ContractorBase):
    pass


class ContractorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    contractor_code: str
    name: str
    cnic: str
    ntn: str | None
    trade: str
    phone: str | None
    bank_name: str | None
    account_iban: str | None
    is_active: bool


class ContractorSummaryOut(ContractorOut):
    agreement_count: int = 0
    total_contract: float = 0
    total_billed: float = 0
    total_paid: float = 0
    total_due: float = 0
    total_retention_held: float = 0


# Agreement


class ContractAgreementBase(BaseModel):
    agreement_date: date
    project_id: int
    contractor_id: int
    scope_title: str = Field(min_length=1)
    work_type: str = Field(min_length=1)
    floors_scope: str | None = None
    basis: ContractBasis
    quantity: float | None = Field(default=None, gt=0)
    rate: float | None = Field(default=None, ge=0)
    # Required for Lump Sum; worked out as quantity × rate otherwise when left out.
    contract_amount: float | None = Field(default=None, gt=0)
    retention_percent: float = Field(default=0, ge=0, le=100)
    wht_percent: float = Field(default=0, ge=0, le=100)
    start_date: date | None = None
    end_date: date | None = None
    status: ContractStatus = ContractStatus.ACTIVE
    remarks: str | None = None

    @model_validator(mode="after")
    def _amount(self):
        if self.contract_amount is None:
            if self.quantity is None or self.rate is None:
                raise ValueError("Enter the contract amount, or the quantity and rate to work it out.")
            self.contract_amount = round(self.quantity * self.rate, 2)
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValueError("End date can't be before the start date.")
        return self


class ContractAgreementCreate(ContractAgreementBase):
    pass


class ContractAgreementUpdate(ContractAgreementBase):
    pass


class ContractorBillCreate(BaseModel):
    bill_date: date
    description: str | None = None
    work_quantity: float | None = Field(default=None, gt=0)
    gross_amount: float = Field(gt=0)


class ContractorBillOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    bill_no: str
    agreement_id: int
    bill_date: date
    description: str | None
    work_quantity: float | None
    gross_amount: float
    retention_amount: float
    wht_amount: float
    net_amount: float


class ContractorPaymentCreate(PaymentModeFields):
    payment_date: date
    purpose: ContractorPaymentPurpose = ContractorPaymentPurpose.BILL_PAYMENT
    amount: float = Field(gt=0)
    credit_account_id: int
    narration: str | None = None


class AgreementRefOut(BaseModel):
    """Just enough of the agreement for a payment voucher print."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    agreement_no: str
    scope_title: str
    work_type: str
    floors_scope: str | None
    project_id: int
    project_name: str
    contractor: ContractorOut


class ContractorPaymentOut(PaymentModeFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    payment_no: str
    agreement_id: int
    payment_date: date
    purpose: ContractorPaymentPurpose
    amount: float
    credit_account_id: int
    voucher_id: int | None
    narration: str | None
    mode_of_payment: str
    credit_account: AccountOut


class ContractorPaymentDetailOut(ContractorPaymentOut):
    agreement: AgreementRefOut


class ContractAgreementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agreement_no: str
    agreement_date: date
    project_id: int
    project_name: str
    contractor_id: int
    contractor: ContractorOut
    scope_title: str
    work_type: str
    floors_scope: str | None
    basis: ContractBasis
    quantity: float | None
    rate: float | None
    contract_amount: float
    retention_percent: float
    wht_percent: float
    start_date: date | None
    end_date: date | None
    status: ContractStatus
    remarks: str | None

    # Running account (see crud.contractor.agreement_totals)
    billed_gross: float = 0
    retention_total: float = 0
    retention_released: float = 0
    retention_held: float = 0
    wht_total: float = 0
    paid_total: float = 0
    advance_paid: float = 0
    due_now: float = 0
    remaining_work: float = 0


class ContractAgreementDetailOut(ContractAgreementOut):
    bills: list[ContractorBillOut] = []
    payments: list[ContractorPaymentOut] = []
