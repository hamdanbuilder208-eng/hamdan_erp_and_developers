import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.models.allottee import Allottee
from app.models.booking import BookingStatus, ExtraChargesReason, ScheduleFrequency
from app.models.project import Project
from app.models.unit import Unit, UnitStatus
from app.schemas.booking import (
    BookingCreate,
    BookingTransferCreate,
    ExtraChargeCreate,
    InstallmentPlanCreate,
)
from tests.conftest import TODAY


def _plan(count: int, total: float, frequency=ScheduleFrequency.MONTHLY, start=TODAY) -> InstallmentPlanCreate:
    return InstallmentPlanCreate(
        frequency=frequency, no_of_installments=count, total_amount=total, start_date=start
    )


def _booking_in(unit: Unit, project: Project, allottee: Allottee, **overrides) -> BookingCreate:
    data = dict(
        booking_date=TODAY,
        project_id=project.id,
        unit_id=unit.id,
        allottee_id=allottee.id,
        status_date=TODAY,
        discount=0,
        down_payment_amount=0,
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
            installment_plans=[_plan(3, float(unit.total_price) - 100_000)],
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
            installment_plans=[
                _plan(2, float(unit.total_price), ScheduleFrequency.QUARTERLY, start=TODAY.replace(month=4))
            ],
        ),
    )

    installment_lines = sorted(
        (l for l in result.schedule_lines if l.installment_no > 0),
        key=lambda l: l.installment_no,
    )
    assert installment_lines[0].due_date.month == 4  # plan starts in April
    assert installment_lines[1].due_date.month == 7  # one quarter later


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


# Extra charges


def _extra(amount: float, reason=ExtraChargesReason.OTHER) -> ExtraChargeCreate:
    return ExtraChargeCreate(reason=reason, amount=amount, charge_date=TODAY)


def test_extra_charges_add_to_total_price(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(
        db,
        _booking_in(unit, project, allottee, extra_charges=[_extra(50_000, ExtraChargesReason.EAST_FACING)]),
    )

    assert result.total_price == unit.total_price + 50_000


def test_extra_charges_create_a_labeled_schedule_line(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(
        db,
        _booking_in(unit, project, allottee, extra_charges=[_extra(50_000, ExtraChargesReason.WATER)]),
    )

    extra_line = next(l for l in result.schedule_lines if l.label == "Extra Charges — Water")
    assert extra_line.amount == 50_000
    assert extra_line.due_date == result.booking_date


def test_extra_charges_are_excluded_from_remaining_installments(db: Session, project, unit, allottee):
    # unit total is 1,000,000 (see conftest). Extra charges are posted as their
    # own line on top, so the installment plans still cover exactly 1,000,000.
    result = booking_crud.create_booking(
        db,
        _booking_in(
            unit, project, allottee,
            extra_charges=[_extra(50_000, ExtraChargesReason.ROAD_FACING)],
            installment_plans=[_plan(2, 1_000_000)],
        ),
    )

    installment_lines = [l for l in result.schedule_lines if l.installment_no > 0]
    assert sum(l.amount for l in installment_lines) == pytest.approx(1_000_000)


def test_extra_charges_amount_requires_a_reason():
    with pytest.raises(ValidationError, match="reason"):
        ExtraChargeCreate(amount=50_000, charge_date=TODAY)


def test_extra_charges_rejects_negative_amount():
    with pytest.raises(ValidationError, match="greater than zero"):
        _extra(-1)


def test_no_extra_charges_line_when_amount_is_zero(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(db, _booking_in(unit, project, allottee))

    assert not any("Extra Charges" in l.label for l in result.schedule_lines)


def test_one_shot_booking_schedules_single_full_payment(db: Session, project, unit, allottee):
    full = float(unit.total_price)
    result = booking_crud.create_booking(
        db, _booking_in(unit, project, allottee, one_shot=True, down_payment_amount=full)
    )
    assert len(result.schedule_lines) == 1
    assert result.schedule_lines[0].label == "Full Payment"
    assert float(result.schedule_lines[0].amount) == full


def test_one_shot_booking_must_be_paid_in_full(db: Session, project, unit, allottee):
    with pytest.raises(ValueError, match="paid in full"):
        booking_crud.create_booking(
            db,
            _booking_in(unit, project, allottee, one_shot=True, down_payment_amount=float(unit.total_price) / 2),
        )


def test_down_payment_line_uses_its_own_date(db: Session, project, unit, allottee):
    """Back-dated bookings: the down payment can be dated separately from the booking."""
    from datetime import date

    result = booking_crud.create_booking(
        db,
        _booking_in(
            unit,
            project,
            allottee,
            booking_date=date(2024, 3, 1),
            down_payment_amount=100_000,
            down_payment_date=date(2024, 3, 5),
            installment_plans=[_plan(2, float(unit.total_price) - 100_000, start=date(2024, 4, 10))],
        ),
    )

    down = next(l for l in result.schedule_lines if l.installment_no == 0)
    assert down.due_date == date(2024, 3, 5)
    assert min(result.schedule_lines, key=lambda l: l.due_date) is down


def test_down_payment_date_defaults_to_booking_date(db: Session, project, unit, allottee):
    from datetime import date

    result = booking_crud.create_booking(
        db,
        _booking_in(unit, project, allottee, booking_date=date(2024, 3, 1), down_payment_amount=100_000),
    )

    down = next(l for l in result.schedule_lines if l.installment_no == 0)
    assert down.due_date == date(2024, 3, 1)


def test_same_date_plans_are_paid_in_entry_order(
    db: Session, project, unit, allottee, cash_account, accounting_accounts
):
    """Plans of 2L, 20L, 30L all due the same day: payments settle them in that order."""
    from app.crud import receipt as receipt_crud
    from app.schemas.receipt import ReceiptCreate

    price = float(unit.total_price)
    small, mid = round(price * 0.04, 2), round(price * 0.38, 2)
    amounts = [small, mid, round(price - small - mid, 2)]
    booking = booking_crud.create_booking(
        db,
        _booking_in(unit, project, allottee, installment_plans=[_plan(1, a) for a in amounts]),
    )
    assert [float(l.amount) for l in booking.schedule_lines] == amounts

    receipt_crud.create_receipt(
        db,
        ReceiptCreate(
            receipt_date=TODAY, booking_id=booking.id, credit_account_id=cash_account.id, amount=small + mid + 1_000
        ),
    )
    db.refresh(booking)
    assert [float(l.paid_amount) for l in booking.schedule_lines] == [small, mid, 1_000]


def test_gas_extra_charge(db: Session, project, unit, allottee):
    result = booking_crud.create_booking(
        db, _booking_in(unit, project, allottee, extra_charges=[_extra(40_000, ExtraChargesReason.GAS)])
    )
    assert result.extra_charges[0].reason_label == "Gas"
    assert any(l.label == "Extra Charges — Gas" for l in result.schedule_lines)


def test_other_extra_charge_uses_typed_name(db: Session, project, unit, allottee):
    charge = ExtraChargeCreate(
        reason=ExtraChargesReason.OTHER, custom_reason="  Maintenance Deposit ", amount=25_000, charge_date=TODAY
    )
    result = booking_crud.create_booking(db, _booking_in(unit, project, allottee, extra_charges=[charge]))

    assert result.extra_charges[0].custom_reason == "Maintenance Deposit"
    assert result.extra_charges[0].reason_label == "Maintenance Deposit"
    assert any(l.label == "Extra Charges — Maintenance Deposit" for l in result.schedule_lines)


def test_extra_charge_added_later_keeps_its_back_date(db: Session, project, unit, allottee):
    from datetime import date

    booking = booking_crud.create_booking(db, _booking_in(unit, project, allottee))
    charge = ExtraChargeCreate(reason=ExtraChargesReason.WATER, amount=75_000, charge_date=date(2024, 9, 18))
    result = booking_crud.add_extra_charge(db, booking, charge)

    assert result.extra_charges[0].charge_date == date(2024, 9, 18)
    line = next(l for l in result.schedule_lines if l.label == "Extra Charges — Water")
    assert line.due_date == date(2024, 9, 18)


def test_edit_extra_charge_updates_line_voucher_and_total(
    db: Session, project, unit, allottee, accounting_accounts
):
    from datetime import date

    from app.models.voucher import Voucher, VoucherLine

    booking = booking_crud.create_booking(
        db, _booking_in(unit, project, allottee, extra_charges=[_extra(50_000, ExtraChargesReason.WATER)])
    )
    charge = booking.extra_charges[0]
    result = booking_crud.update_extra_charge(
        db,
        charge,
        ExtraChargeCreate(reason=ExtraChargesReason.ELECTRICITY, amount=80_000, charge_date=date(2024, 9, 18)),
    )

    assert float(result.total_price) == float(unit.total_price) + 80_000
    edited = result.extra_charges[0]
    assert edited.reason_label == "Electricity"
    assert edited.charge_date == date(2024, 9, 18)
    line = next(l for l in result.schedule_lines if l.id == edited.schedule_line_id)
    assert line.label == "Extra Charges — Electricity"
    assert line.due_date == date(2024, 9, 18)
    assert float(line.amount) == 80_000
    voucher = db.query(Voucher).filter(Voucher.id == charge.voucher_id).one()
    assert voucher.voucher_date == date(2024, 9, 18)
    lines = db.query(VoucherLine).filter(VoucherLine.voucher_id == voucher.id).all()
    assert sum(float(l.debit) for l in lines) == 80_000
    assert sum(float(l.credit) for l in lines) == 80_000


def test_edit_extra_charge_cannot_go_below_amount_received(
    db: Session, project, unit, allottee, accounting_accounts
):
    booking = booking_crud.create_booking(
        db, _booking_in(unit, project, allottee, extra_charges=[_extra(50_000, ExtraChargesReason.WATER)])
    )
    charge = booking.extra_charges[0]
    line = next(l for l in booking.schedule_lines if l.id == charge.schedule_line_id)
    line.paid_amount = 30_000
    db.commit()

    with pytest.raises(ValueError, match="already been received"):
        booking_crud.update_extra_charge(
            db, charge, ExtraChargeCreate(reason=ExtraChargesReason.WATER, amount=20_000, charge_date=TODAY)
        )


def test_other_extra_charge_requires_a_name():
    with pytest.raises(ValidationError, match="type what the charge is for"):
        ExtraChargeCreate(reason=ExtraChargesReason.OTHER, custom_reason=" ", amount=1_000, charge_date=TODAY)


def test_custom_name_ignored_for_listed_reasons():
    charge = ExtraChargeCreate(
        reason=ExtraChargesReason.WATER, custom_reason="ignored", amount=1_000, charge_date=TODAY
    )
    assert charge.custom_reason is None
