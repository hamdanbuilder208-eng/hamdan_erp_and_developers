from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.booking import Booking
from app.models.booking_agent import BookingAgent
from app.models.commission_payout import CommissionPayout
from app.schemas.booking_agent import (
    BookingAgentCreate,
    BookingAgentSummary,
    BookingAgentUpdate,
    BookingCommissionRow,
)


def _next_agent_code(db: Session) -> str:
    return next_sequence_number(db, BookingAgent.agent_code, "BKR-", 5)


def list_agents(db: Session) -> list[BookingAgent]:
    return db.query(BookingAgent).options(joinedload(BookingAgent.linked_account)).order_by(
        BookingAgent.id.desc()
    ).all()


def get_agent(db: Session, agent_id: int) -> BookingAgent | None:
    return (
        db.query(BookingAgent)
        .options(joinedload(BookingAgent.linked_account))
        .filter(BookingAgent.id == agent_id)
        .first()
    )


def create_agent(db: Session, agent_in: BookingAgentCreate) -> BookingAgent:
    db_agent = BookingAgent(agent_code=_next_agent_code(db), **agent_in.model_dump())
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)
    return db_agent


def update_agent(db: Session, db_agent: BookingAgent, agent_in: BookingAgentUpdate) -> BookingAgent:
    for field, value in agent_in.model_dump(exclude_unset=True).items():
        setattr(db_agent, field, value)
    db.commit()
    db.refresh(db_agent)
    return db_agent


def delete_agent(db: Session, db_agent: BookingAgent) -> None:
    bookings = db.query(Booking).filter(Booking.booking_agent_id == db_agent.id).all()
    if bookings:
        refs = ", ".join(b.booking_ref_no for b in bookings)
        raise ValueError(
            f"This agent is linked to {len(bookings)} booking(s): {refs}. "
            "Unlink or remove those bookings first (Unit Booking tab)."
        )
    db.delete(db_agent)
    db.commit()


def _commission_row(db: Session, booking: Booking) -> BookingCommissionRow:
    received_amount = sum(float(l.paid_amount) for l in booking.schedule_lines)
    total_price = float(booking.total_price)
    received_percent = (received_amount / total_price * 100) if total_price > 0 else 0
    commission_percent = float(booking.agent_commission_percent or 0)
    # Commission is eligible as soon as any payment is received — proportional to
    # whatever's come in so far, no minimum-received-percent gate.
    commission_eligible_amount = commission_percent / 100 * received_amount

    paid = (
        db.query(CommissionPayout)
        .filter(CommissionPayout.booking_id == booking.id)
        .all()
    )
    commission_paid = sum(float(p.amount) for p in paid)

    return BookingCommissionRow(
        booking_id=booking.id,
        booking_ref_no=booking.booking_ref_no,
        unit_number=booking.unit.unit_number,
        allottee_name=booking.allottee.name,
        total_price=total_price,
        received_amount=received_amount,
        received_percent=round(received_percent, 2),
        commission_percent=commission_percent,
        is_eligible=received_amount > 0,
        commission_eligible_amount=round(commission_eligible_amount, 2),
        commission_paid=round(commission_paid, 2),
        commission_balance=round(commission_eligible_amount - commission_paid, 2),
    )


def get_agent_summary(db: Session, agent_id: int) -> BookingAgentSummary | None:
    agent = get_agent(db, agent_id)
    if not agent:
        return None

    bookings = (
        db.query(Booking)
        .options(
            joinedload(Booking.unit),
            joinedload(Booking.allottee),
            joinedload(Booking.schedule_lines),
        )
        .filter(Booking.booking_agent_id == agent_id, Booking.status != "Cancelled")
        .all()
    )

    rows = [_commission_row(db, b) for b in bookings]

    return BookingAgentSummary(
        agent=agent,
        bookings=rows,
        total_eligible=round(sum(r.commission_eligible_amount for r in rows), 2),
        total_paid=round(sum(r.commission_paid for r in rows), 2),
        total_balance=round(sum(r.commission_balance for r in rows), 2),
    )
