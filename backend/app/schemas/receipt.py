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
    pass


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
