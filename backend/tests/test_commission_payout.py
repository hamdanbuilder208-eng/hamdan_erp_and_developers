import pytest
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.crud import commission_payout as payout_crud
from app.crud import receipt as receipt_crud
from app.crud.booking_agent import _commission_row
from app.models.booking_agent import BookingAgent
from app.models.voucher import Voucher
from app.schemas.booking import BookingCreate
from app.schemas.commission_payout import CommissionPayoutCreate
from app.schemas.receipt import ReceiptCreate
from tests.conftest import TODAY


@pytest.fixture()
def agent(db: Session) -> BookingAgent:
    obj = BookingAgent(agent_code="BKR-001", name="Test Agent", default_commission_percent=5)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def booking_with_agent(db: Session, project, unit, allottee, accounting_accounts, agent):
    """Booking with a 5% agent commission, no installments (single lump sum
    balance) so a single receipt makes the whole price 'received'."""
    return booking_crud.create_booking(
        db,
        BookingCreate(
            booking_date=TODAY,
            project_id=project.id,
            unit_id=unit.id,
            allottee_id=allottee.id,
            status_date=TODAY,
            booking_agent_id=agent.id,
            agent_commission_percent=5,
            no_of_installments=1,
        ),
    )


def _receive_full_amount(db, booking, cash_account):
    receipt_crud.create_receipt(
        db,
        ReceiptCreate(
            receipt_date=TODAY,
            booking_id=booking.id,
            credit_account_id=cash_account.id,
            amount=float(booking.total_price),
        ),
    )
    db.refresh(booking)


def test_commission_eligible_amount_is_percent_of_received(
    db: Session, booking_with_agent, cash_account
):
    _receive_full_amount(db, booking_with_agent, cash_account)

    row = _commission_row(db, booking_with_agent)
    assert row.commission_eligible_amount == 50_000  # 5% of 1,000,000


def test_create_payout_within_eligible_balance_succeeds(
    db: Session, booking_with_agent, agent, cash_account
):
    _receive_full_amount(db, booking_with_agent, cash_account)

    payout = payout_crud.create_payout(
        db,
        CommissionPayoutCreate(
            payout_date=TODAY,
            booking_id=booking_with_agent.id,
            agent_id=agent.id,
            credit_account_id=cash_account.id,
            amount=30_000,
        ),
    )
    assert payout.amount == 30_000

    row = _commission_row(db, booking_with_agent)
    assert row.commission_paid == 30_000
    assert row.commission_balance == 20_000  # 50,000 eligible - 30,000 paid


def test_create_payout_rejects_amount_over_eligible_balance(
    db: Session, booking_with_agent, agent, cash_account
):
    _receive_full_amount(db, booking_with_agent, cash_account)

    with pytest.raises(ValueError, match="exceeds the commission balance"):
        payout_crud.create_payout(
            db,
            CommissionPayoutCreate(
                payout_date=TODAY,
                booking_id=booking_with_agent.id,
                agent_id=agent.id,
                credit_account_id=cash_account.id,
                amount=60_000,  # eligible is only 50,000
            ),
        )


def test_create_payout_rejects_agent_not_linked_to_booking(
    db: Session, booking_with_agent, cash_account
):
    other_agent = BookingAgent(agent_code="BKR-002", name="Other Agent")
    db.add(other_agent)
    db.commit()

    with pytest.raises(ValueError, match="not linked"):
        payout_crud.create_payout(
            db,
            CommissionPayoutCreate(
                payout_date=TODAY,
                booking_id=booking_with_agent.id,
                agent_id=other_agent.id,
                credit_account_id=cash_account.id,
                amount=1_000,
            ),
        )


def test_payout_posts_balanced_voucher(db: Session, booking_with_agent, agent, cash_account):
    _receive_full_amount(db, booking_with_agent, cash_account)

    payout = payout_crud.create_payout(
        db,
        CommissionPayoutCreate(
            payout_date=TODAY,
            booking_id=booking_with_agent.id,
            agent_id=agent.id,
            credit_account_id=cash_account.id,
            amount=30_000,
        ),
    )

    voucher = db.get(Voucher, payout.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 30_000


def test_delete_payout_removes_voucher(db: Session, booking_with_agent, agent, cash_account):
    _receive_full_amount(db, booking_with_agent, cash_account)
    payout = payout_crud.create_payout(
        db,
        CommissionPayoutCreate(
            payout_date=TODAY,
            booking_id=booking_with_agent.id,
            agent_id=agent.id,
            credit_account_id=cash_account.id,
            amount=30_000,
        ),
    )
    voucher_id = payout.voucher_id

    payout_crud.delete_payout(db, payout)

    assert db.get(Voucher, voucher_id) is None
