from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.core.payment_details import apply_payment_details
from app.core.sequences import next_sequence_number
from app.models.booking import PaymentMode
from app.models.land_property import LandProperty, LandPropertyPayment, LandPropertyStatus
from app.models.receipt import ChequeStatus
from app.schemas.land_property import LandPropertyCreate, LandPropertyPaymentCreate, LandPropertyUpdate


def _next_property_ref_no(db: Session) -> str:
    return next_sequence_number(db, LandProperty.property_ref_no, "LND-", 5)


def list_land_properties(
    db: Session,
    property_type: str | None = None,
    status: str | None = None,
    area_location: str | None = None,
) -> list[LandProperty]:
    query = db.query(LandProperty).options(joinedload(LandProperty.payments))
    if property_type is not None:
        query = query.filter(LandProperty.property_type == property_type)
    if status is not None:
        query = query.filter(LandProperty.status == status)
    if area_location is not None:
        query = query.filter(LandProperty.area_location.ilike(f"%{area_location}%"))
    return query.order_by(LandProperty.id.desc()).all()


def get_land_property(db: Session, property_id: int) -> LandProperty | None:
    return (
        db.query(LandProperty)
        .options(joinedload(LandProperty.payments))
        .filter(LandProperty.id == property_id)
        .first()
    )


def create_land_property(db: Session, property_in: LandPropertyCreate) -> LandProperty:
    db_property = LandProperty(
        property_ref_no=_next_property_ref_no(db),
        **property_in.model_dump(),
    )
    db.add(db_property)
    db.commit()
    db.refresh(db_property)
    return db_property


def update_land_property(
    db: Session, db_property: LandProperty, property_in: LandPropertyUpdate
) -> LandProperty:
    changes = property_in.model_dump(exclude_unset=True)
    # A property marked Sold must carry the price it actually sold for — the
    # buyer's "remaining" is measured against it, not the originally hoped-for rate.
    new_status = changes.get("status", db_property.status)
    new_sale_rate = changes.get("sale_rate", db_property.sale_rate)
    if new_status == LandPropertyStatus.SOLD and not (new_sale_rate and float(new_sale_rate) > 0):
        raise ValueError("Enter the actual sale price to mark this property as Sold")
    for field, value in changes.items():
        setattr(db_property, field, value)
    db.commit()
    db.refresh(db_property)
    return db_property


def delete_land_property(db: Session, db_property: LandProperty) -> None:
    db.delete(db_property)
    db.commit()


def get_payment(db: Session, payment_id: int) -> LandPropertyPayment | None:
    return db.query(LandPropertyPayment).filter(LandPropertyPayment.id == payment_id).first()


def create_payment(
    db: Session, db_property: LandProperty, payment_in: LandPropertyPaymentCreate
) -> LandPropertyPayment:
    data = payment_in.model_dump()
    db_payment = LandPropertyPayment(land_property_id=db_property.id, **data)
    apply_payment_details(db_payment, payment_in.mode_of_payment, data)
    if payment_in.mode_of_payment == PaymentMode.CHEQUE:
        db_payment.cheque_status = ChequeStatus.PENDING
    else:
        db_payment.cheque_date = db_payment.cheque_clearing_date = None
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


def list_pending_cheques(db: Session, due_by: date | None = None) -> list[LandPropertyPayment]:
    """Land / plot cheques not yet confirmed — for the dashboard reminder."""
    query = (
        db.query(LandPropertyPayment)
        .options(joinedload(LandPropertyPayment.land_property))
        .filter(LandPropertyPayment.cheque_status == ChequeStatus.PENDING)
    )
    if due_by is not None:
        query = query.filter(LandPropertyPayment.cheque_clearing_date <= due_by)
    return query.order_by(LandPropertyPayment.cheque_clearing_date.asc()).all()


def mark_cheque_status(
    db: Session, db_payment: LandPropertyPayment, new_status: ChequeStatus
) -> LandPropertyPayment:
    """These payments aren't posted to the books, so only the status changes;
    a bounced one simply stops counting toward what's been paid."""
    if db_payment.mode_of_payment != PaymentMode.CHEQUE:
        raise ValueError("This payment was not made by cheque")
    if db_payment.cheque_status == new_status:
        raise ValueError(f"This cheque is already marked {new_status.value}")
    if new_status not in (ChequeStatus.CLEARED, ChequeStatus.BOUNCED):
        raise ValueError("Status must be Cleared or Bounced")
    db_payment.cheque_status = new_status
    db.commit()
    db.refresh(db_payment)
    return db_payment


def delete_payment(db: Session, db_payment: LandPropertyPayment) -> None:
    db.delete(db_payment)
    db.commit()
