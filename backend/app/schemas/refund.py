from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.refund import RefundType
from app.schemas.account import AccountOut
from app.schemas.booking import BookingOut


class RefundBase(BaseModel):
    refund_date: date
    refund_type: RefundType
    booking_id: int | None = None
    party_name: str | None = None
    account_id: int
    cash_account_id: int
    gross_amount: float
    deduction_percent: float | None = None
    deduction_amount: float = 0
    narration: str | None = None

    @model_validator(mode="after")
    def validate_type_fields(self):
        if self.refund_type == RefundType.CUSTOMER and not self.booking_id:
            raise ValueError("Customer refunds must reference a booking")
        if self.refund_type in (RefundType.VENDOR, RefundType.EMPLOYEE) and not self.party_name:
            raise ValueError(f"{self.refund_type.value} refunds must have a party name")
        if self.gross_amount <= 0:
            raise ValueError("Amount must be greater than zero")
        if self.deduction_amount > self.gross_amount:
            raise ValueError("Deduction cannot exceed the gross amount")
        return self


class RefundCreate(RefundBase):
    pass


class RefundOut(RefundBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    refund_no: str
    net_amount: float
    voucher_id: int | None
    account: AccountOut
    cash_account: AccountOut
    booking: BookingOut | None = None
