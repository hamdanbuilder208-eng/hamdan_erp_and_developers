from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.receipt import ChequeStatus, ReceiptPaymentType
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
    narration: str | None = None


class ReceiptOut(ReceiptBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    receipt_no: str
    voucher_id: int | None
    cheque_status: ChequeStatus | None
    credit_account: AccountOut


class ReceiptWithBookingOut(ReceiptOut):
    booking: BookingOut


class ChequeStatusUpdate(BaseModel):
    status: ChequeStatus
