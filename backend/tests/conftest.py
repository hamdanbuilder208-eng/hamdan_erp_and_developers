from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 - registers all models on Base.metadata
from app.db.base_class import Base
from app.models.account import Account, AccountNature
from app.models.allottee import Allottee
from app.models.project import Project
from app.models.unit import Unit, UnitStatus


@pytest.fixture()
def db() -> Session:
    """A fresh in-memory SQLite database per test, built from the same
    SQLAlchemy models as production (MySQL) so CRUD logic is exercised
    end-to-end without needing a real database server."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def project(db: Session) -> Project:
    obj = Project(project_code="PRJ-001", project_name="Test Project")
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def allottee(db: Session) -> Allottee:
    obj = Allottee(allottee_code="ALT-001", name="Test Allottee")
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def unit(db: Session, project: Project) -> Unit:
    obj = Unit(
        unit_ref_no="UNIT-001",
        project_id=project.id,
        unit_number="A-101",
        base_price=1_000_000,
        total_price=1_000_000,
        status=UnitStatus.AVAILABLE,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def accounting_accounts(db: Session) -> tuple[Account, Account]:
    """The receivable/revenue accounts booking creation looks up by code
    to post its double-entry journal voucher."""
    receivable = Account(code="1030", name="Accounts Receivable", nature=AccountNature.ASSET)
    revenue = Account(code="4010", name="Unit Sales", nature=AccountNature.REVENUE)
    db.add_all([receivable, revenue])
    db.commit()
    return receivable, revenue


@pytest.fixture()
def cash_account(db: Session) -> Account:
    obj = Account(code="1010", name="Cash in Hand", nature=AccountNature.ASSET)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def land_property(db: Session):
    from app.models.land_property import LandProperty, LandPropertyStatus, PropertyType, SizeUnit

    obj = LandProperty(
        property_ref_no="LND-001",
        property_type=PropertyType.COMMERCIAL_SHOP,
        area_location="Main Boulevard",
        size_number=500,
        size_unit=SizeUnit.SQ_FT,
        status=LandPropertyStatus.AVAILABLE,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def tenant(db: Session):
    from app.crud import rental as rental_crud
    from app.schemas.rental import TenantCreate

    return rental_crud.create_tenant(db, TenantCreate(name="Test Tenant", mobile="03001234567"))


@pytest.fixture()
def rental_income_account(db: Session) -> Account:
    obj = Account(code="4030", name="Rental Income", nature=AccountNature.REVENUE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def partner(db: Session):
    from app.crud import partner as partner_crud
    from app.schemas.partner import PartnerCreate

    return partner_crud.create_partner(db, PartnerCreate(name="Test Partner"))


@pytest.fixture()
def booking(db: Session, project, unit, allottee, accounting_accounts):
    """A real booking created through the booking CRUD (not hand-built), so its
    payment schedule lines are exactly what receipt tests need to allocate
    against — 2 installments of 500,000 each, no down payment."""
    from app.crud import booking as booking_crud
    from app.models.booking import ScheduleFrequency
    from app.schemas.booking import BookingCreate

    return booking_crud.create_booking(
        db,
        BookingCreate(
            booking_date=TODAY,
            project_id=project.id,
            unit_id=unit.id,
            allottee_id=allottee.id,
            status_date=TODAY,
            no_of_installments=2,
            frequency=ScheduleFrequency.MONTHLY,
        ),
    )


TODAY = date(2026, 1, 1)
