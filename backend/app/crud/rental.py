from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.land_property import LandProperty, LandPropertyStatus
from app.models.rental import (
    RentAgreement,
    RentAgreementStatus,
    RentScheduleLine,
    Tenant,
)
from app.models.unit import Unit, UnitStatus
from app.schemas.rental import RentAgreementCreate, TenantCreate

# Tenant


def _next_tenant_code(db: Session) -> str:
    return next_sequence_number(db, Tenant.tenant_code, "TEN-", 5)


def list_tenants(db: Session) -> list[Tenant]:
    return db.query(Tenant).order_by(Tenant.id.desc()).all()


def get_tenant(db: Session, tenant_id: int) -> Tenant | None:
    return db.query(Tenant).filter(Tenant.id == tenant_id).first()


def create_tenant(db: Session, tenant_in: TenantCreate) -> Tenant:
    db_tenant = Tenant(tenant_code=_next_tenant_code(db), **tenant_in.model_dump())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    return db_tenant


def delete_tenant(db: Session, db_tenant: Tenant) -> None:
    agreements = db.query(RentAgreement).filter(RentAgreement.tenant_id == db_tenant.id).all()
    if agreements:
        refs = ", ".join(a.agreement_no for a in agreements)
        raise ValueError(
            f"This tenant has {len(agreements)} rent agreement(s) on record: {refs}. "
            "Terminate and delete those first."
        )
    db.delete(db_tenant)
    db.commit()


# Rent Agreement


def _next_agreement_no(db: Session) -> str:
    return next_sequence_number(db, RentAgreement.agreement_no, "RNT-", 5)


def _load_query(db: Session):
    return db.query(RentAgreement).options(
        joinedload(RentAgreement.tenant),
        joinedload(RentAgreement.unit),
        joinedload(RentAgreement.land_property),
        joinedload(RentAgreement.schedule_lines),
    )


def list_agreements(db: Session, status: str | None = None) -> list[RentAgreement]:
    query = _load_query(db)
    if status is not None:
        query = query.filter(RentAgreement.status == status)
    return query.order_by(RentAgreement.id.desc()).all()


def get_agreement(db: Session, agreement_id: int) -> RentAgreement | None:
    return _load_query(db).filter(RentAgreement.id == agreement_id).first()


def create_agreement(db: Session, agreement_in: RentAgreementCreate) -> RentAgreement:
    tenant = db.query(Tenant).filter(Tenant.id == agreement_in.tenant_id).first()
    if not tenant:
        raise ValueError("Tenant not found")

    unit: Unit | None = None
    land_property: LandProperty | None = None

    if agreement_in.unit_id:
        unit = db.query(Unit).filter(Unit.id == agreement_in.unit_id).first()
        if not unit:
            raise ValueError("Unit not found")
        if unit.status != UnitStatus.AVAILABLE:
            raise ValueError(f"Unit is not available (current status: {unit.status.value})")
    else:
        land_property = (
            db.query(LandProperty).filter(LandProperty.id == agreement_in.land_property_id).first()
        )
        if not land_property:
            raise ValueError("Property not found")
        if land_property.status != LandPropertyStatus.AVAILABLE:
            raise ValueError(f"Property is not available (current status: {land_property.status.value})")

    db_agreement = RentAgreement(
        agreement_no=_next_agreement_no(db),
        agreement_date=agreement_in.agreement_date,
        tenant_id=agreement_in.tenant_id,
        unit_id=agreement_in.unit_id,
        land_property_id=agreement_in.land_property_id,
        monthly_rent=agreement_in.monthly_rent,
        security_deposit=agreement_in.security_deposit,
        start_date=agreement_in.start_date,
        duration_months=agreement_in.duration_months,
        narration=agreement_in.narration,
    )
    db.add(db_agreement)
    db.flush()

    for month_no in range(1, agreement_in.duration_months + 1):
        due_date = agreement_in.start_date + relativedelta(months=month_no - 1)
        db.add(
            RentScheduleLine(
                agreement_id=db_agreement.id,
                month_no=month_no,
                due_date=due_date,
                amount=agreement_in.monthly_rent,
            )
        )

    if unit:
        unit.status = UnitStatus.RENTED
    if land_property:
        land_property.status = LandPropertyStatus.RENTED

    db.commit()
    return get_agreement(db, db_agreement.id)


def terminate_agreement(db: Session, db_agreement: RentAgreement, end_date: date) -> RentAgreement:
    if db_agreement.status != RentAgreementStatus.ACTIVE:
        raise ValueError(f"This agreement is already {db_agreement.status.value.lower()}")

    if db_agreement.unit_id:
        unit = db.query(Unit).filter(Unit.id == db_agreement.unit_id).first()
        if unit and unit.status == UnitStatus.RENTED:
            unit.status = UnitStatus.AVAILABLE
    if db_agreement.land_property_id:
        land_property = (
            db.query(LandProperty).filter(LandProperty.id == db_agreement.land_property_id).first()
        )
        if land_property and land_property.status == LandPropertyStatus.RENTED:
            land_property.status = LandPropertyStatus.AVAILABLE

    db_agreement.status = RentAgreementStatus.TERMINATED
    db.commit()
    return get_agreement(db, db_agreement.id)


def delete_agreement(db: Session, db_agreement: RentAgreement) -> None:
    from app.models.rental import RentReceipt

    receipts = db.query(RentReceipt).filter(RentReceipt.agreement_id == db_agreement.id).all()
    if receipts:
        refs = ", ".join(r.receipt_no for r in receipts)
        raise ValueError(
            f"This agreement has {len(receipts)} rent receipt(s) recorded against it that must be "
            f"deleted first: {refs}"
        )

    if db_agreement.status == RentAgreementStatus.ACTIVE:
        if db_agreement.unit_id:
            unit = db.query(Unit).filter(Unit.id == db_agreement.unit_id).first()
            if unit and unit.status == UnitStatus.RENTED:
                unit.status = UnitStatus.AVAILABLE
        if db_agreement.land_property_id:
            land_property = (
                db.query(LandProperty).filter(LandProperty.id == db_agreement.land_property_id).first()
            )
            if land_property and land_property.status == LandPropertyStatus.RENTED:
                land_property.status = LandPropertyStatus.AVAILABLE

    db.delete(db_agreement)
    db.commit()
