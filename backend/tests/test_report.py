from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.crud import report as report_crud
from app.models.booking import PaymentScheduleLine
from tests.conftest import TODAY


def test_trial_balance_is_balanced_after_booking_voucher(db: Session, booking):
    report = report_crud.get_trial_balance(db)

    assert report.is_balanced
    assert report.total_debit == report.total_credit == float(booking.total_price)


def test_profit_loss_nets_revenue_against_expense(db: Session, booking):
    pl = report_crud.get_profit_loss(db)

    assert pl.total_revenue == float(booking.total_price)
    assert pl.total_expense == 0
    assert pl.net_profit == float(booking.total_price)


def test_balance_sheet_balances_with_retained_earnings(db: Session, booking):
    bs = report_crud.get_balance_sheet(db)

    assert bs.is_balanced
    assert bs.total_assets == float(booking.total_price)
    # No liability/capital accounts touched — the whole asset is retained earnings.
    assert bs.retained_earnings == float(booking.total_price)


def test_general_ledger_running_balance_tracks_postings(db: Session, booking, accounting_accounts):
    receivable_account, _ = accounting_accounts

    ledger = report_crud.get_general_ledger(db, receivable_account.id)

    assert ledger.opening_balance == 0
    assert ledger.closing_balance == float(booking.total_price)
    assert len(ledger.lines) == 1
    assert ledger.lines[0].running_balance == float(booking.total_price)


def test_general_ledger_returns_none_for_unknown_account(db: Session):
    assert report_crud.get_general_ledger(db, 99999) is None


def test_aging_report_buckets_overdue_installments_by_days_past_due(db: Session, project, unit, allottee):
    booking_row_id = _make_booking_with_two_overdue_lines(db, project, unit, allottee)

    # 45 days after the reference date used below: first line is 45 days overdue
    # (31-60 bucket), second is 10 days overdue (0-30 bucket).
    as_of = TODAY + timedelta(days=45)
    report = report_crud.get_aging_report(db, as_of_date=as_of)

    row = next(r for r in report.rows if r.booking_id == booking_row_id)
    assert row.bucket_0_30 == 50_000  # due TODAY+35, 10 days overdue at as_of
    assert row.bucket_31_60 == 100_000  # due TODAY, 45 days overdue at as_of
    assert row.total_outstanding == 150_000


def _make_booking_with_two_overdue_lines(db, project, unit, allottee):
    from app.crud import booking as booking_crud
    from app.schemas.booking import BookingCreate

    result = booking_crud.create_booking(
        db,
        BookingCreate(
            booking_date=TODAY,
            project_id=project.id,
            unit_id=unit.id,
            allottee_id=allottee.id,
            status_date=TODAY,
        ),
    )
    # create_booking with no installments leaves no schedule lines — add our own
    # with controlled due dates so the aging buckets are deterministic.
    db.add(
        PaymentScheduleLine(
            booking_id=result.id, installment_no=1, due_date=TODAY, amount=100_000
        )
    )
    db.add(
        PaymentScheduleLine(
            booking_id=result.id,
            installment_no=2,
            due_date=TODAY + timedelta(days=35),
            amount=50_000,
        )
    )
    db.commit()
    return result.id


def test_customer_wise_report_computes_balance_per_allottee(db: Session, booking, allottee, cash_account, accounting_accounts):
    from app.crud import receipt as receipt_crud
    from app.schemas.receipt import ReceiptCreate

    receipt_crud.create_receipt(
        db,
        ReceiptCreate(
            receipt_date=TODAY, booking_id=booking.id, credit_account_id=cash_account.id, amount=300_000
        ),
    )

    report = report_crud.get_customer_wise_report(db)
    row = next(r for r in report.rows if r.allottee_id == allottee.id)

    assert row.total_booked == float(booking.total_price)
    assert row.total_received == 300_000
    assert row.balance == float(booking.total_price) - 300_000
