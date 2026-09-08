import pytest
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.models.allottee import Allottee
from app.models.booking import BookingStatus, ScheduleFrequency
from app.models.project import Project
from app.models.unit import Unit, UnitStatus
from app.schemas.booking import BookingCreate, BookingTransferCreate
from tests.conftest import TODAY


def _booking_in(unit: Unit, project: Project, allottee: Allottee, **overrides) -> BookingCreate:
    data = dict(
        booking_date=TODAY,
        project_id=project.id,
        unit_id=unit.id,
        allottee_id=allottee.id,
        status_date=TODAY,
        discount=0,
        down_payment_amount=0,
        no_of_installments=0,
        frequency=ScheduleFrequency.MONTHLY,
    )
    data.update(overrides)
    return BookingCreate(**data)


def test_create_booking_marks_unit_as_booked(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(db, _booking_in(unit, project, allottee))

    assert result.unit.status == UnitStatus.BOOKED
    assert result.total_price == unit.total_price


def test_create_booking_rejects_unavailable_unit(db: Session, project, unit, allottee):
    unit.status = UnitStatus.BOOKED
    db.commit()

    with pytest.raises(ValueError, match="not available"):
        booking_crud.create_booking(db, _booking_in(unit, project, allottee))


def test_create_booking_applies_discount_to_total_price(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(
        db, _booking_in(unit, project, allottee, discount=50_000)
    )

    assert result.total_price == unit.total_price - 50_000


def test_installment_schedule_sums_to_remaining_balance(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(
        db,
        _booking_in(
            unit,
            project,
            allottee,
            down_payment_amount=100_000,
            no_of_installments=3,
        ),
    )

    lines = result.schedule_lines
    down_payment_lines = [l for l in lines if l.installment_no == 0]
    installment_lines = [l for l in lines if l.installment_no > 0]

    assert len(down_payment_lines) == 1
    assert down_payment_lines[0].amount == 100_000
    assert len(installment_lines) == 3
    # Rounding remainder is absorbed into the last installment, so the full
    # schedule must reconcile exactly to the price net of down payment.
    assert sum(l.amount for l in installment_lines) == pytest.approx(
        result.total_price - 100_000
    )


def test_installment_due_dates_step_by_frequency(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(
        db,
        _booking_in(
            unit,
            project,
            allottee,
            no_of_installments=2,
            frequency=ScheduleFrequency.QUARTERLY,
        ),
    )

    installment_lines = sorted(
        (l for l in result.schedule_lines if l.installment_no > 0),
        key=lambda l: l.installment_no,
    )
    assert installment_lines[0].due_date.month == 4  # +3 months from Jan
    assert installment_lines[1].due_date.month == 7  # +6 months from Jan


def test_create_booking_posts_balanced_journal_voucher(
    db: Session, project, unit, allottee, accounting_accounts
):
    result = booking_crud.create_booking(db, _booking_in(unit, project, allottee))

    assert result.revenue_voucher_id is not None
    from app.models.voucher import Voucher

    voucher = db.get(Voucher, result.revenue_voucher_id)
    lines = voucher.lines
    total_debit = sum(l.debit for l in lines)
    total_credit = sum(l.credit for l in lines)

    assert total_debit == total_credit == unit.total_price


def test_create_booking_skips_voucher_when_accounts_missing(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(db, _booking_in(unit, project, allottee))

    assert result.revenue_voucher_id is None


def test_transfer_reassigns_booking_to_new_allottee(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(db, _booking_in(unit, project, allottee))
    new_allottee = Allottee(allottee_code="ALT-002", name="New Owner")
    db.add(new_allottee)
    db.commit()

    booking_crud.create_transfer(
        db, result, BookingTransferCreate(to_allottee_id=new_allottee.id, transfer_date=TODAY)
    )

    db.refresh(result)
    assert result.allottee_id == new_allottee.id


def test_transfer_rejects_same_allottee(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(db, _booking_in(unit, project, allottee))

    with pytest.raises(ValueError, match="already held"):
        booking_crud.create_transfer(
            db, result, BookingTransferCreate(to_allottee_id=allottee.id, transfer_date=TODAY)
        )


def test_transfer_rejects_cancelled_booking(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(db, _booking_in(unit, project, allottee))
    result.status = BookingStatus.CANCELLED
    db.commit()
    new_allottee = Allottee(allottee_code="ALT-002", name="New Owner")
    db.add(new_allottee)
    db.commit()

    with pytest.raises(ValueError, match="cancelled"):
        booking_crud.create_transfer(
            db, result, BookingTransferCreate(to_allottee_id=new_allottee.id, transfer_date=TODAY)
        )
