from pydantic import BaseModel


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
