"""Instrument details for money received/paid by Cheque or Bank Transfer —
shared by every form that records a payment mode (booking receipts, rent
receipts, land/plot payments), so they all ask for and check the same things."""

CHEQUE_FIELDS = ("cheque_no", "cheque_bank_name")
TRANSFER_FIELDS = (
    "transfer_bank_name",
    "transfer_account_title",  # from: whose account the money left
    "transfer_account_no",
    "transfer_ref_no",
    "transfer_to_account_title",  # to: the account it landed in
    "transfer_to_account_no",
)
TRANSFER_MODES = ("Bank Transfer", "Online")


def _mode_str(mode) -> str:
    return getattr(mode, "value", mode) or ""


def _blank(value) -> bool:
    return not (value or "").strip()


def validate_payment_details(mode, details: dict) -> None:
    """Raises ValueError if the mode's required instrument details are missing."""
    mode = _mode_str(mode)
    if mode == "Cheque":
        if _blank(details.get("cheque_no")) or _blank(details.get("cheque_bank_name")):
            raise ValueError("For a Cheque payment, enter the cheque number and the bank name.")
    elif mode in TRANSFER_MODES:
        missing = [
            label
            for key, label in (
                ("transfer_account_title", "sender's account name"),
                ("transfer_account_no", "sender's account number"),
                ("transfer_to_account_title", "receiver's account name"),
                ("transfer_to_account_no", "receiver's account number"),
            )
            if _blank(details.get(key))
        ]
        if missing:
            raise ValueError(f"For {mode} payments, enter the {', '.join(missing)}.")


def apply_payment_details(target, mode, details: dict, validate: bool = True) -> None:
    """Validates, then copies the fields that belong to `mode` onto `target`
    and clears the ones that don't (e.g. no cheque number on a cash receipt)."""
    if validate:
        validate_payment_details(mode, details)
    mode = _mode_str(mode)
    keep = CHEQUE_FIELDS if mode == "Cheque" else TRANSFER_FIELDS if mode in TRANSFER_MODES else ()
    for field in CHEQUE_FIELDS + TRANSFER_FIELDS:
        if not hasattr(target, field):
            continue
        value = details.get(field) if field in keep else None
        setattr(target, field, value.strip() if isinstance(value, str) and value.strip() else None)
