from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.receipt import ChequeForwardStatus, ChequeStatus, ReceiptPaymentType
from app.schemas.account import AccountOut
from app.schemas.booking import BookingOut


class ReceiptBase(BaseModel):
    receipt_date: date
    booking_id: int
    credit_account_id: int
    amount: float
    payment_type: ReceiptPaymentType = ReceiptPaymentType.INSTALLMENT
    mode_of_payment: str = "Cash"
    cheque_no: str | None = None
    cheque_date: date | None = None
    cheque_clearing_date: date | None = None
    transfer_bank_name: str | None = None
    transfer_account_title: str | None = None
    transfer_account_no: str | None = None
    transfer_ref_no: str | None = None
    transfer_to_account_title: str | None = None
    transfer_to_account_no: str | None = None
    cheque_bank_name: str | None = None
    narration: str | None = None


class ReceiptCreate(ReceiptBase):
    # Which schedule line to settle first — lets staff target e.g. the 2nd
    # installment specifically instead of the default oldest-due-first
    # allocation. Any amount left over after that line still spills into the
    # rest, oldest first. None keeps the old always-oldest-first behavior.
    schedule_line_id: int | None = None


class ReceiptUpdate(BaseModel):
    receipt_date: date | None = None
    booking_id: int | None = None
    credit_account_id: int | None = None
    amount: float | None = None
    payment_type: ReceiptPaymentType | None = None
    mode_of_payment: str | None = None
    cheque_no: str | None = None
    cheque_date: date | None = None
    cheque_clearing_date: date | None = None
    transfer_bank_name: str | None = None
    transfer_account_title: str | None = None
    transfer_account_no: str | None = None
    transfer_ref_no: str | None = None
    transfer_to_account_title: str | None = None
    transfer_to_account_no: str | None = None
    cheque_bank_name: str | None = None
    narration: str | None = None


class AllocatedScheduleLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    installment_no: int
    label: str
    due_date: date


class ReceiptAllocationOut(BaseModel):
    """Which installment(s) this receipt paid, and how much went to each."""

    model_config = ConfigDict(from_attributes=True)
    amount: float
    schedule_line: AllocatedScheduleLineOut


class ChequeForwardCreate(BaseModel):
    """Hand a pending customer cheque on to another party as payment."""

    forward_date: date
    party_name: str
    party_contact: str | None = None
    # Expense / payable account the payment is for.
    debit_account_id: int
    narration: str | None = None

    @field_validator("party_name")
    @classmethod
    def party_name_required(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Enter who the cheque was given to")
        return v.strip()


class ChequeForwardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    forward_no: str
    forward_date: date
    party_name: str
    party_contact: str | None
    debit_account: AccountOut
    voucher_id: int | None
    status: ChequeForwardStatus
    status_date: date | None
    narration: str | None


class ReceiptOut(ReceiptBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    receipt_no: str
    voucher_id: int | None
    cheque_status: ChequeStatus | None
    credit_account: AccountOut
    allocations: list[ReceiptAllocationOut] = []
    # Every time this cheque was handed on to another party, oldest first.
    forwards: list[ChequeForwardOut] = []


class ReceiptWithBookingOut(ReceiptOut):
    booking: BookingOut


class ReceiptPrintOut(ReceiptWithBookingOut):
    # schedule_line_id -> amount paid on it as of this receipt (see
    # receipt_crud.line_paid_as_of); booking.schedule_lines is as of today.
    line_paid_as_of: dict[int, float] = {}


class ChequeStatusUpdate(BaseModel):
    status: ChequeStatus
