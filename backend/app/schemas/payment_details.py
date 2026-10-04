from pydantic import BaseModel

from app.models.booking import PaymentMode


class PaymentDetailsFields(BaseModel):
    """Cheque / bank-transfer details sent with a payment (see app/core/payment_details.py)."""

    cheque_no: str | None = None
    cheque_bank_name: str | None = None
    transfer_bank_name: str | None = None
    transfer_account_title: str | None = None
    transfer_account_no: str | None = None
    transfer_ref_no: str | None = None
    transfer_to_account_title: str | None = None
    transfer_to_account_no: str | None = None


class PaymentModeFields(PaymentDetailsFields):
    """Mode of payment plus its cheque / transfer details — for every form that
    pays from or into an account (expenses, wages, GRNs, refunds, top-ups, ...)."""

    mode_of_payment: PaymentMode = PaymentMode.CASH
