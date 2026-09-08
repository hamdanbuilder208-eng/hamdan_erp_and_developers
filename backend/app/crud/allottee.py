from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.sequences import next_sequence_number
from app.models.allottee import Allottee
from app.models.booking import Booking
from app.models.customer_account import CustomerAccount
from app.schemas.allottee import AllotteeCreate, AllotteeUpdate


def _next_allottee_code(db: Session) -> str:
    return next_sequence_number(db, Allottee.allottee_code, "ALT-", 5)


def list_allottees(db: Session, search: str | None = None) -> list[Allottee]:
    query = db.query(Allottee)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Allottee.name.ilike(like),
                Allottee.cnic.ilike(like),
                Allottee.mobile.ilike(like),
                Allottee.allottee_code.ilike(like),
            )
        )
    return query.order_by(Allottee.id.desc()).all()


def get_allottee(db: Session, allottee_id: int) -> Allottee | None:
    return db.query(Allottee).filter(Allottee.id == allottee_id).first()


def create_allottee(db: Session, allottee_in: AllotteeCreate) -> Allottee:
    db_allottee = Allottee(
        allottee_code=_next_allottee_code(db),
        **allottee_in.model_dump(),
    )
    db.add(db_allottee)
    db.commit()
    db.refresh(db_allottee)
    return db_allottee


def update_allottee(db: Session, db_allottee: Allottee, allottee_in: AllotteeUpdate) -> Allottee:
    for field, value in allottee_in.model_dump(exclude_unset=True).items():
        setattr(db_allottee, field, value)
    db.commit()
    db.refresh(db_allottee)
    return db_allottee


def delete_allottee(db: Session, db_allottee: Allottee) -> None:
    bookings = db.query(Booking).filter(Booking.allottee_id == db_allottee.id).all()
    if bookings:
        refs = ", ".join(b.booking_ref_no for b in bookings)
        raise ValueError(
            f"This allottee has {len(bookings)} booking(s) that must be cancelled and "
            f"deleted first (Unit Booking tab): {refs}"
        )
    # Portal login credentials are just an auth record with no independent
    # business value once the allottee itself is gone — cascade it silently
    # rather than making the user hunt for a delete button that doesn't exist
    # (there's no admin-facing tab for customer portal accounts).
    portal_account = db.query(CustomerAccount).filter(CustomerAccount.allottee_id == db_allottee.id).first()
    if portal_account:
        db.delete(portal_account)
    db.delete(db_allottee)
    db.commit()
