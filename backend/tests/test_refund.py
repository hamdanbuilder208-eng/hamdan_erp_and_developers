import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.crud import refund as refund_crud
from app.models.account import Account, AccountNature
from app.models.booking import BookingStatus
from app.models.voucher import Voucher
from app.schemas.refund import RefundCreate, RefundPaymentCreate
from tests.conftest import TODAY


@pytest.fixture()
def expense_account(db: Session) -> Account:
    obj = Account(code="5010", name="Refund Expense", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def paid_booking(db: Session, project, unit, allottee, accounting_accounts, cash_account):
    """A booking the customer has paid PKR 300,000 on (down payment + cash receipt)."""
    from app.crud import booking as booking_crud
    from app.crud import receipt as receipt_crud
    from app.schemas.booking import BookingCreate
    from app.schemas.receipt import ReceiptCreate

    booking = booking_crud.create_booking(
        db,
        BookingCreate(
            booking_date=TODAY,
            project_id=project.id,
            unit_id=unit.id,
            allottee_id=allottee.id,
            status_date=TODAY,
            down_payment_amount=300_000,
        ),
    )
    receipt_crud.create_receipt(
        db,
        ReceiptCreate(
            receipt_date=TODAY, booking_id=booking.id, credit_account_id=cash_account.id, amount=300_000
        ),
    )
    return booking


def test_customer_refund_requires_booking_id():
    with pytest.raises(ValidationError, match="must reference a booking"):
        RefundCreate(
            refund_date=TODAY,
            refund_type="Customer",
            account_id=1,
            cash_account_id=2,
            gross_amount=1000,
        )


def test_vendor_refund_requires_a_vendor():
    with pytest.raises(ValidationError, match="must name the vendor"):
        RefundCreate(
            refund_date=TODAY,
            refund_type="Vendor",
            account_id=1,
            cash_account_id=2,
            gross_amount=1000,
        )


@pytest.fixture()
def vendor(db: Session):
    from app.models.inventory import Vendor

    obj = Vendor(vendor_code="VND-T1", name="ABC Traders")
    db.add(obj)
    db.commit()
    return obj


def test_refund_rejects_deduction_over_gross_amount():
    with pytest.raises(ValidationError, match="cannot exceed the gross amount"):
        RefundCreate(
            refund_date=TODAY,
            refund_type="Vendor",
            party_name="ABC Traders",
            account_id=1,
            cash_account_id=2,
            gross_amount=1000,
            deduction_amount=1500,
        )


def test_customer_refund_computes_net_amount_and_cancels_booking(
    db: Session, paid_booking, expense_account, cash_account
):
    result = refund_crud.create_refund(
        db,
        RefundCreate(
            refund_date=TODAY,
            refund_type="Customer",
            booking_id=paid_booking.id,
            account_id=expense_account.id,
            cash_account_id=cash_account.id,
            gross_amount=100_000,
            deduction_amount=10_000,
        ),
    )

    assert result.net_amount == 90_000
    db.refresh(paid_booking)
    assert paid_booking.status == BookingStatus.CANCELLED


def test_customer_refund_rejects_already_cancelled_booking(
    db: Session, booking, expense_account, cash_account
):
    booking.status = BookingStatus.CANCELLED
    db.commit()

    with pytest.raises(ValueError, match="already cancelled"):
        refund_crud.create_refund(
            db,
            RefundCreate(
                refund_date=TODAY,
                refund_type="Customer",
                booking_id=booking.id,
                account_id=expense_account.id,
                cash_account_id=cash_account.id,
                gross_amount=50_000,
            ),
        )


def test_vendor_refund_does_not_require_or_touch_a_booking(
    db: Session, expense_account, cash_account, vendor
):
    result = refund_crud.create_refund(
        db,
        RefundCreate(
            refund_date=TODAY,
            refund_type="Vendor",
            vendor_id=vendor.id,
            gross_amount=20_000,
        ),
    )
    assert result.booking is None
    assert result.net_amount == 20_000
    assert result.party_name == "ABC Traders"  # filled from the vendor


def test_vendor_refund_against_grn_is_capped_and_credits_stock(db: Session, cash_account, vendor):
    from app.models.account import Account, AccountNature
    from app.models.inventory import GRN
    from app.models.voucher import VoucherLine
    from app.schemas.refund import RefundPaymentCreate

    stock = Account(code="1040", name="Material / Inventory Stock", nature=AccountNature.ASSET)
    db.add(stock)
    db.flush()
    grn = GRN(grn_no="GRN-T1", grn_date=TODAY, vendor_id=vendor.id, payment_account_id=cash_account.id, total_amount=50_000)
    db.add(grn)
    db.commit()

    with pytest.raises(ValueError, match="at most PKR 50,000"):
        refund_crud.create_refund(
            db, RefundCreate(refund_date=TODAY, refund_type="Vendor", vendor_id=vendor.id, grn_id=grn.id, gross_amount=60_000)
        )
    refund = refund_crud.create_refund(
        db, RefundCreate(refund_date=TODAY, refund_type="Vendor", vendor_id=vendor.id, grn_id=grn.id, gross_amount=30_000)
    )
    assert refund.grn.grn_no == "GRN-T1"

    # No account picked: money back on a GRN comes off material stock.
    refund = refund_crud.add_payment(
        db, refund, RefundPaymentCreate(payment_date=TODAY, amount=30_000, cash_account_id=cash_account.id)
    )
    lines = db.query(VoucherLine).filter(VoucherLine.voucher_id == refund.payments[0].voucher_id).all()
    assert {(l.account_id, float(l.debit), float(l.credit)) for l in lines} == {
        (cash_account.id, 30_000, 0),
        (stock.id, 0, 30_000),
    }


def _customer_refund(db: Session, booking, gross: float, deduction: float = 0):
    return refund_crud.create_refund(
        db,
        RefundCreate(
            refund_date=TODAY,
            refund_type="Customer",
            booking_id=booking.id,
            gross_amount=gross,
            deduction_amount=deduction,
        ),
    )


def test_refund_payment_posts_balanced_voucher(db: Session, paid_booking, expense_account, cash_account):
    # The voucher is posted per payment (a refund is often paid in installments),
    # not when the refund itself is recorded.
    refund = _customer_refund(db, paid_booking, 100_000, deduction=10_000)
    result = refund_crud.add_payment(
        db,
        refund,
        RefundPaymentCreate(
            payment_date=TODAY, amount=90_000, account_id=expense_account.id, cash_account_id=cash_account.id
        ),
    )

    voucher = db.get(Voucher, result.payments[0].voucher_id)
    total_debit = sum(l.debit for l in voucher.lines)
    total_credit = sum(l.credit for l in voucher.lines)
    assert total_debit == total_credit == 90_000  # net_amount, not gross


def test_delete_refund_removes_payment_vouchers(db: Session, paid_booking, expense_account, cash_account):
    refund = _customer_refund(db, paid_booking, 50_000)
    result = refund_crud.add_payment(
        db,
        refund,
        RefundPaymentCreate(
            payment_date=TODAY, amount=50_000, account_id=expense_account.id, cash_account_id=cash_account.id
        ),
    )
    voucher_id = result.payments[0].voucher_id

    refund_crud.delete_refund(db, result)

    assert db.get(Voucher, voucher_id) is None


def test_customer_refund_cannot_exceed_amount_paid(db: Session, paid_booking):
    with pytest.raises(ValueError, match="more than the PKR 300,000.00"):
        _customer_refund(db, paid_booking, 300_001)


def test_customer_refund_rejects_booking_with_nothing_paid(db: Session, booking):
    with pytest.raises(ValueError, match="hasn't paid anything"):
        _customer_refund(db, booking, 1_000)


def test_customer_refund_does_not_duplicate_auto_refund_on_cancel(db: Session, paid_booking):
    _customer_refund(db, paid_booking, 300_000, deduction=30_000)
    refunds = refund_crud.list_refunds(db, booking_id=paid_booking.id)
    assert len(refunds) == 1
    assert refunds[0].net_amount == 270_000


def test_vendor_options_list_grns_with_amount_refunded(db: Session, cash_account, vendor):
    from app.models.inventory import GRN

    grn = GRN(grn_no="GRN-T2", grn_date=TODAY, vendor_id=vendor.id, payment_account_id=cash_account.id, total_amount=40_000)
    db.add(grn)
    db.commit()
    refund_crud.create_refund(
        db, RefundCreate(refund_date=TODAY, refund_type="Vendor", vendor_id=vendor.id, grn_id=grn.id, gross_amount=15_000)
    )
    option = next(v for v in refund_crud.vendor_options(db) if v["id"] == vendor.id)
    assert [(g["grn_no"], g["total_amount"], g["refunded"]) for g in option["grns"]] == [("GRN-T2", 40_000, 15_000)]
