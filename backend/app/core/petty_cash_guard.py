"""Stops any payment from taking a petty cash float below zero.

A float can be paid from in many places (petty cash expenses, office
expenses, GRN/material payments, refunds, commission payouts, ...), so rather
than repeating the check in each, every flush is watched: if a new voucher
line credits a petty cash float's account and that leaves it negative, the
flush fails with InsufficientPettyCash and nothing is saved."""

from sqlalchemy import event
from sqlalchemy.orm import Session

_PENDING_KEY = "petty_cash_credited"


class InsufficientPettyCash(ValueError):
    pass


@event.listens_for(Session, "after_flush")
def _collect_credited_accounts(session: Session, flush_context) -> None:
    from app.models.voucher import VoucherLine

    ids = {
        obj.account_id
        for obj in list(session.new) + list(session.dirty)
        if isinstance(obj, VoucherLine) and float(obj.credit or 0) > 0
    }
    if ids:
        session.info.setdefault(_PENDING_KEY, set()).update(ids)


@event.listens_for(Session, "after_flush_postexec")
def _check_petty_cash_balances(session: Session, flush_context) -> None:
    ids = session.info.pop(_PENDING_KEY, None)
    if not ids:
        return

    from app.crud.account import account_balance
    from app.models.petty_cash import PettyCashFloat

    with session.no_autoflush:
        floats = session.query(PettyCashFloat).filter(PettyCashFloat.account_id.in_(ids)).all()
        for db_float in floats:
            balance = account_balance(session, db_float.account_id)
            if balance < -0.005:
                raise InsufficientPettyCash(
                    f"Not enough petty cash with {db_float.holder_name} ({db_float.float_code}): "
                    f"this payment would leave the float at PKR {balance:,.2f}. "
                    "Top up the float first (Petty Cash > Top-ups)."
                )
