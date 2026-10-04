from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column


class PaymentDetailsMixin:
    """Cheque / bank-transfer details for a payment row (see app/core/payment_details.py)."""

    cheque_no: Mapped[str | None] = mapped_column(String(50))
    cheque_bank_name: Mapped[str | None] = mapped_column(String(100))
    transfer_bank_name: Mapped[str | None] = mapped_column(String(100))
    transfer_account_title: Mapped[str | None] = mapped_column(String(150))
    transfer_account_no: Mapped[str | None] = mapped_column(String(50))
    transfer_ref_no: Mapped[str | None] = mapped_column(String(80))
    transfer_to_account_title: Mapped[str | None] = mapped_column(String(150))
    transfer_to_account_no: Mapped[str | None] = mapped_column(String(50))


class PaymentModeMixin(PaymentDetailsMixin):
    """Mode of payment plus its cheque / transfer details, for payments made
    from or into an account (expenses, wages, GRNs, refunds, top-ups, ...)."""

    mode_of_payment: Mapped[str] = mapped_column(String(30), default="Cash", server_default="Cash")
