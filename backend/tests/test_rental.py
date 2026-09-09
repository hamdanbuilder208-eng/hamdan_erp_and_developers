import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.crud import rental as rental_crud
from app.models.land_property import LandPropertyStatus
from app.models.rental import RentAgreementStatus
from app.models.unit import UnitStatus
from app.schemas.rental import RentAgreementCreate
from tests.conftest import TODAY


def _agreement_in(tenant, **overrides) -> RentAgreementCreate:
    data = dict(
        agreement_date=TODAY,
        tenant_id=tenant.id,
        monthly_rent=25_000,
        security_deposit=50_000,
        start_date=TODAY,
        duration_months=3,
    )
    data.update(overrides)
    return RentAgreementCreate(**data)


# Schema validation


def test_agreement_rejects_both_unit_and_property(tenant):
    with pytest.raises(ValidationError, match="not both, not neither"):
        _agreement_in(tenant, unit_id=1, land_property_id=1)


def test_agreement_rejects_neither_unit_nor_property(tenant):
    with pytest.raises(ValidationError, match="not both, not neither"):
        _agreement_in(tenant)


def test_agreement_rejects_zero_duration(tenant, land_property):
    with pytest.raises(ValidationError, match="at least 1 month"):
        _agreement_in(tenant, land_property_id=land_property.id, duration_months=0)


def test_agreement_rejects_zero_rent(tenant, land_property):
    with pytest.raises(ValidationError, match="greater than zero"):
        _agreement_in(tenant, land_property_id=land_property.id, monthly_rent=0)


# Creating an agreement against a property


def test_create_agreement_generates_monthly_schedule(db: Session, tenant, land_property):
    result = rental_crud.create_agreement(
        db, _agreement_in(tenant, land_property_id=land_property.id, duration_months=3)
    )

    assert len(result.schedule_lines) == 3
    assert [l.month_no for l in result.schedule_lines] == [1, 2, 3]
    assert all(l.amount == 25_000 for l in result.schedule_lines)
    assert result.schedule_lines[1].due_date.month == TODAY.month + 1


def test_create_agreement_marks_property_as_rented(db: Session, tenant, land_property):
    rental_crud.create_agreement(
        db, _agreement_in(tenant, land_property_id=land_property.id)
    )

    db.refresh(land_property)
    assert land_property.status == LandPropertyStatus.RENTED


def test_create_agreement_marks_unit_as_rented(db: Session, tenant, unit):
    rental_crud.create_agreement(db, _agreement_in(tenant, unit_id=unit.id))

    db.refresh(unit)
    assert unit.status == UnitStatus.RENTED


def test_create_agreement_rejects_unavailable_property(db: Session, tenant, land_property):
    land_property.status = LandPropertyStatus.SOLD
    db.commit()

    with pytest.raises(ValueError, match="not available"):
        rental_crud.create_agreement(
            db, _agreement_in(tenant, land_property_id=land_property.id)
        )


def test_create_agreement_rejects_already_rented_property(db: Session, tenant, land_property):
    rental_crud.create_agreement(
        db, _agreement_in(tenant, land_property_id=land_property.id)
    )

    with pytest.raises(ValueError, match="not available"):
        rental_crud.create_agreement(
            db, _agreement_in(tenant, land_property_id=land_property.id)
        )


# Terminating

def test_terminate_agreement_reverts_property_to_available(db: Session, tenant, land_property):
    agreement = rental_crud.create_agreement(
        db, _agreement_in(tenant, land_property_id=land_property.id)
    )

    rental_crud.terminate_agreement(db, agreement, TODAY)

    db.refresh(land_property)
    assert land_property.status == LandPropertyStatus.AVAILABLE
    assert agreement.status == RentAgreementStatus.TERMINATED


def test_terminate_agreement_allows_renting_again(db: Session, tenant, land_property):
    agreement = rental_crud.create_agreement(
        db, _agreement_in(tenant, land_property_id=land_property.id)
    )
    rental_crud.terminate_agreement(db, agreement, TODAY)

    # Should not raise now that the property is available again.
    rental_crud.create_agreement(db, _agreement_in(tenant, land_property_id=land_property.id))


def test_terminate_already_terminated_agreement_rejected(db: Session, tenant, land_property):
    agreement = rental_crud.create_agreement(
        db, _agreement_in(tenant, land_property_id=land_property.id)
    )
    rental_crud.terminate_agreement(db, agreement, TODAY)

    with pytest.raises(ValueError, match="already"):
        rental_crud.terminate_agreement(db, agreement, TODAY)


# Delete guards

def test_delete_agreement_reverts_status_when_still_active(db: Session, tenant, land_property):
    agreement = rental_crud.create_agreement(
        db, _agreement_in(tenant, land_property_id=land_property.id)
    )

    rental_crud.delete_agreement(db, agreement)

    db.refresh(land_property)
    assert land_property.status == LandPropertyStatus.AVAILABLE


def test_delete_tenant_blocked_when_agreements_exist(db: Session, tenant, land_property):
    rental_crud.create_agreement(db, _agreement_in(tenant, land_property_id=land_property.id))

    with pytest.raises(ValueError, match="rent agreement"):
        rental_crud.delete_tenant(db, tenant)


def test_delete_tenant_succeeds_when_untouched(db: Session, tenant):
    rental_crud.delete_tenant(db, tenant)
    assert rental_crud.get_tenant(db, tenant.id) is None
