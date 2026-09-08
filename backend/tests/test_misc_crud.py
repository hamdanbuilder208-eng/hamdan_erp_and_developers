import pytest
from sqlalchemy.orm import Session

from app.crud import account as account_crud
from app.crud import allottee as allottee_crud
from app.crud import booking as booking_crud
from app.crud import booking_agent as booking_agent_crud
from app.crud import data_integrity
from app.crud import project as project_crud
from app.crud import unit as unit_crud
from app.crud import user as user_crud
from app.crud import voucher as voucher_crud
from app.models.account import AccountNature
from app.models.booking_agent import BookingAgent
from app.models.voucher import VoucherType
from app.schemas.account import AccountCreate
from app.schemas.allottee import AllotteeCreate
from app.schemas.booking import BookingCreate
from app.schemas.project import ProjectCreate
from app.schemas.unit import UnitCategoryCreate, UnitCreate
from app.schemas.user import RoleCreate, UserCreate
from app.schemas.voucher import VoucherCreate, VoucherLineCreate
from tests.conftest import TODAY


# Account


def test_create_account_assigns_sequential_code_by_nature(db: Session):
    a1 = account_crud.create_account(db, AccountCreate(name="Cash", nature=AccountNature.ASSET))
    a2 = account_crud.create_account(db, AccountCreate(name="Bank", nature=AccountNature.ASSET))
    e1 = account_crud.create_account(db, AccountCreate(name="Rent", nature=AccountNature.EXPENSE))

    assert a1.code == "1001"
    assert a2.code == "1002"
    assert e1.code == "5001"  # different nature prefix, independent sequence


def test_account_balance_combines_opening_balance_and_postings(db: Session, cash_account):
    cash_account.opening_debit = 1_000
    db.commit()
    other = account_crud.create_account(db, AccountCreate(name="Bank", nature=AccountNature.ASSET))

    voucher_crud.create_voucher(
        db,
        VoucherCreate(
            voucher_type=VoucherType.JOURNAL,
            voucher_date=TODAY,
            lines=[
                VoucherLineCreate(account_id=cash_account.id, debit=500, credit=0),
                VoucherLineCreate(account_id=other.id, debit=0, credit=500),
            ],
        ),
    )
    voucher_crud.create_voucher(
        db,
        VoucherCreate(
            voucher_type=VoucherType.JOURNAL,
            voucher_date=TODAY,
            lines=[
                VoucherLineCreate(account_id=other.id, debit=200, credit=0),
                VoucherLineCreate(account_id=cash_account.id, debit=0, credit=200),
            ],
        ),
    )

    assert account_crud.account_balance(db, cash_account.id) == 1_300  # 1000 + 500 - 200


def test_delete_account_blocked_when_it_has_voucher_postings(db: Session, cash_account):
    voucher_crud.create_voucher(
        db,
        VoucherCreate(
            voucher_type=VoucherType.JOURNAL,
            voucher_date=TODAY,
            lines=[
                VoucherLineCreate(account_id=cash_account.id, debit=100, credit=0),
                VoucherLineCreate(account_id=cash_account.id, debit=0, credit=100),
            ],
        ),
    )

    with pytest.raises(ValueError, match="cannot be deleted"):
        account_crud.delete_account(db, cash_account)


def test_delete_account_blocked_when_it_has_sub_accounts(db: Session, cash_account):
    account_crud.create_account(
        db, AccountCreate(name="Petty Cash", nature=AccountNature.ASSET, parent_id=cash_account.id)
    )

    with pytest.raises(ValueError, match="sub-account"):
        account_crud.delete_account(db, cash_account)


# Voucher


def test_voucher_create_rejects_unbalanced_lines(db: Session, cash_account):
    with pytest.raises(ValueError, match="not balanced"):
        VoucherCreate(
            voucher_type=VoucherType.JOURNAL,
            voucher_date=TODAY,
            lines=[
                VoucherLineCreate(account_id=cash_account.id, debit=100, credit=0),
                VoucherLineCreate(account_id=cash_account.id, debit=0, credit=50),
            ],
        )


def test_voucher_create_rejects_single_line():
    with pytest.raises(ValueError, match="at least two lines"):
        VoucherCreate(
            voucher_type=VoucherType.JOURNAL,
            voucher_date=TODAY,
            lines=[VoucherLineCreate(account_id=1, debit=100, credit=100)],
        )


def test_delete_voucher_blocked_when_generated_by_a_receipt(db: Session, booking, cash_account):
    from app.crud import receipt as receipt_crud
    from app.schemas.receipt import ReceiptCreate

    receipt = receipt_crud.create_receipt(
        db,
        ReceiptCreate(
            receipt_date=TODAY, booking_id=booking.id, credit_account_id=cash_account.id, amount=100_000
        ),
    )
    voucher = voucher_crud.get_voucher(db, receipt.voucher_id)

    with pytest.raises(ValueError, match="auto-generated"):
        voucher_crud.delete_voucher(db, voucher)


def test_delete_voucher_succeeds_for_a_manual_voucher(db: Session, cash_account):
    other = account_crud.create_account(db, AccountCreate(name="Bank", nature=AccountNature.ASSET))
    voucher = voucher_crud.create_voucher(
        db,
        VoucherCreate(
            voucher_type=VoucherType.CONTRA,
            voucher_date=TODAY,
            lines=[
                VoucherLineCreate(account_id=cash_account.id, debit=100, credit=0),
                VoucherLineCreate(account_id=other.id, debit=0, credit=100),
            ],
        ),
    )

    voucher_crud.delete_voucher(db, voucher)

    assert voucher_crud.get_voucher(db, voucher.id) is None


# Allottee / Unit / Project delete guards


def test_delete_allottee_blocked_when_booking_exists(db: Session, booking, allottee):
    with pytest.raises(ValueError, match="booking"):
        allottee_crud.delete_allottee(db, allottee)


def test_delete_unit_blocked_when_booking_exists(db: Session, booking, unit):
    with pytest.raises(ValueError, match="booking"):
        unit_crud.delete_unit(db, unit)


def test_delete_project_blocked_when_booking_exists(db: Session, booking, project):
    with pytest.raises(ValueError, match="booking"):
        project_crud.delete_project(db, project)


def test_unit_total_price_is_base_plus_extra_charges(db: Session, project):
    result = unit_crud.create_unit(
        db,
        project.id,
        UnitCreate(unit_number="B-201", project_id=project.id, base_price=900_000, extra_charges=50_000),
    )
    assert result.total_price == 950_000


def test_unit_category_rejects_duplicate_name(db: Session):
    unit_crud.create_unit_category(db, UnitCategoryCreate(name="2 Bed"))

    with pytest.raises(ValueError, match="already exists"):
        unit_crud.create_unit_category(db, UnitCategoryCreate(name="2 Bed"))


def test_delete_agent_blocked_when_linked_to_booking(db: Session, project, unit, allottee):
    agent = BookingAgent(agent_code="BKR-001", name="Agent")
    db.add(agent)
    db.commit()

    booking_crud.create_booking(
        db,
        BookingCreate(
            booking_date=TODAY,
            project_id=project.id,
            unit_id=unit.id,
            allottee_id=allottee.id,
            status_date=TODAY,
            booking_agent_id=agent.id,
        ),
    )

    with pytest.raises(ValueError, match="linked to"):
        booking_agent_crud.delete_agent(db, agent)


# Data integrity checks


def test_integrity_check_flags_unbalanced_voucher(db: Session, cash_account):
    from app.models.voucher import Voucher, VoucherLine

    voucher = Voucher(voucher_no="JV-BAD-1", voucher_type=VoucherType.JOURNAL, voucher_date=TODAY)
    db.add(voucher)
    db.flush()
    db.add(VoucherLine(voucher_id=voucher.id, account_id=cash_account.id, debit=100, credit=0))
    db.add(VoucherLine(voucher_id=voucher.id, account_id=cash_account.id, debit=0, credit=90))
    db.commit()

    results = data_integrity.run_checks(db)
    unbalanced = next(r for r in results if r.name == "Unbalanced vouchers")
    assert not unbalanced.ok
    assert unbalanced.issue_count == 1


def test_integrity_check_passes_clean_database(db: Session, booking):
    results = data_integrity.run_checks(db)
    unbalanced = next(r for r in results if r.name == "Unbalanced vouchers")
    price_mismatch = next(r for r in results if r.name == "Booking price mismatch")
    assert unbalanced.ok
    assert price_mismatch.ok


# User / Role


@pytest.fixture()
def role(db: Session):
    return user_crud.create_role(db, RoleCreate(name="Accountant", allowed_modules=["bookings"]))


def test_create_user_hashes_password_and_authenticates(db: Session, role):
    user_crud.create_user(
        db, UserCreate(username="fahad", password="secret123", role_id=role.id)
    )

    assert user_crud.authenticate_user(db, "fahad", "secret123") is not None
    assert user_crud.authenticate_user(db, "fahad", "wrongpass") is None


def test_delete_role_blocked_when_users_assigned(db: Session, role):
    user_crud.create_user(db, UserCreate(username="fahad", password="secret123", role_id=role.id))

    with pytest.raises(ValueError, match="assigned to"):
        user_crud.delete_role(db, role)
