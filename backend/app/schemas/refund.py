from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.refund import RefundStatus, RefundType
from app.schemas.account import AccountOut
from app.schemas.booking import BookingOut
from app.schemas.payment_details import PaymentModeFields


class RefundBase(BaseModel):
    refund_date: date
    refund_type: RefundType
    booking_id: int | None = None
    vendor_id: int | None = None
    grn_id: int | None = None
    party_name: str | None = None
    gross_amount: float
    deduction_percent: float | None = None
    deduction_amount: float = 0
    narration: str | None = None

    @model_validator(mode="after")
    def validate_type_fields(self):
        if self.refund_type == RefundType.CUSTOMER and not self.booking_id:
            raise ValueError("Customer refunds must reference a booking")
        if self.refund_type == RefundType.EMPLOYEE and not self.party_name:
            raise ValueError("Employee refunds must have a party name")
        # (older vendor refunds have only a name; new ones pick the vendor)
        if self.refund_type == RefundType.VENDOR and not (self.party_name or self.vendor_id):
            raise ValueError("Vendor refunds must name the vendor")
        if self.gross_amount <= 0:
            raise ValueError("Amount must be greater than zero")
        if self.deduction_amount > self.gross_amount:
            raise ValueError("Deduction cannot exceed the gross amount")
        return self


class RefundCreate(RefundBase):
    @model_validator(mode="after")
    def validate_vendor(self):
        if self.refund_type == RefundType.VENDOR and not self.vendor_id:
            raise ValueError("Select the vendor this refund is from")
        if self.deduction_percent is not None and not 0 <= self.deduction_percent <= 100:
            raise ValueError("Deduction must be between 0% and 100%")
        return self


class RefundGrnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    grn_no: str
    grn_date: date
    total_amount: float


class RefundGrnOption(RefundGrnOut):
    refunded: float = 0  # already refunded against this GRN


class RefundVendorOption(BaseModel):
    id: int
    vendor_code: str
    name: str
    grns: list[RefundGrnOption] = []


class RefundDeductionUpdate(BaseModel):
    deduction_percent: float | None = Field(default=None, ge=0, le=100)
    deduction_amount: float = Field(default=0, ge=0)


class RefundPaymentCreate(PaymentModeFields):
    payment_date: date
    amount: float
    # Not needed for a booking's customer refund — that always reverses Unit Sales.
    account_id: int | None = None
    cash_account_id: int
    narration: str | None = None

    @model_validator(mode="after")
    def validate_amount(self):
        if self.amount <= 0:
            raise ValueError("Payment amount must be greater than zero")
        return self


class RefundPaymentOut(PaymentModeFields):
    model_config = ConfigDict(from_attributes=True)
    id: int
    refund_id: int
    payment_date: date
    amount: float
    voucher_id: int | None
    narration: str | None
    account: AccountOut
    cash_account: AccountOut


class RefundOut(RefundBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    refund_no: str
    status: RefundStatus
    net_amount: float
    booking: BookingOut | None = None
    grn: RefundGrnOut | None = None
    payments: list[RefundPaymentOut] = []
