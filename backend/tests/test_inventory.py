import pytest
from sqlalchemy.orm import Session

from app.crud import inventory as inventory_crud
from app.models.account import Account, AccountNature
from app.models.inventory import (
    Material,
    MaterialIssueReason,
    StockLedger,
    StockRefType,
    Vendor,
    Warehouse,
)
from app.models.voucher import Voucher
from app.schemas.inventory import (
    GRNCreate,
    GRNLineCreate,
    MaterialCreate,
    MaterialIssueCreate,
    MaterialIssueLineCreate,
    MaterialTransferCreate,
    OpeningStockCreate,
    VendorCreate,
    WarehouseCreate,
)
from tests.conftest import TODAY


@pytest.fixture()
def vendor(db: Session) -> Vendor:
    return inventory_crud.create_vendor(db, VendorCreate(name="ABC Traders"))


@pytest.fixture()
def warehouse(db: Session) -> Warehouse:
    return inventory_crud.create_warehouse(db, WarehouseCreate(name="Main Store"))


@pytest.fixture()
def warehouse_2(db: Session) -> Warehouse:
    return inventory_crud.create_warehouse(db, WarehouseCreate(name="Site Store"))


@pytest.fixture()
def material(db: Session) -> Material:
    return inventory_crud.create_material(db, MaterialCreate(name="Cement", unit_of_measure="Bag"))


@pytest.fixture()
def material_stock_account(db: Session) -> Account:
    obj = Account(code="1040", name="Material Stock", nature=AccountNature.ASSET)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def consumption_account(db: Session) -> Account:
    obj = Account(code="5050", name="Material Consumption", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def _grn(vendor, warehouse, payment_account, material, quantity, rate, **overrides) -> GRNCreate:
    data = dict(
        grn_date=TODAY,
        vendor_id=vendor.id,
        warehouse_id=warehouse.id,
        payment_account_id=payment_account.id if payment_account else None,
        lines=[GRNLineCreate(material_id=material.id, quantity=quantity, rate=rate)],
    )
    data.update(overrides)
    return GRNCreate(**data)


def test_create_grn_posts_stock_in_and_balanced_voucher(
    db, vendor, warehouse, material, material_stock_account, cash_account
):
    grn = inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 10))

    assert grn.total_amount == 1_000
    ledger = db.query(StockLedger).filter(StockLedger.ref_type == StockRefType.GRN).first()
    assert ledger.balance_qty == 100
    assert ledger.balance_value == 1_000

    voucher = db.get(Voucher, grn.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 1_000


def test_second_grn_accumulates_weighted_average_value(
    db, vendor, warehouse, material, material_stock_account, cash_account
):
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 10))  # 1,000
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 20))  # +2,000

    balance_qty, balance_value = inventory_crud._get_current_balance(db, material.id, warehouse.id)
    assert balance_qty == 200
    assert balance_value == 3_000  # weighted average rate = 15/unit


def test_material_issue_costs_at_current_weighted_average_rate(
    db, vendor, warehouse, material, material_stock_account, consumption_account, cash_account, project
):
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 10))  # avg 10
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 20))  # avg 15

    issue = inventory_crud.create_material_issue(
        db,
        MaterialIssueCreate(
            issue_date=TODAY,
            project_id=project.id,
            warehouse_id=warehouse.id,
            lines=[MaterialIssueLineCreate(material_id=material.id, quantity=50)],
        ),
    )

    assert issue.lines[0].rate == 15
    assert issue.lines[0].amount == 750


def test_material_issue_rejects_insufficient_stock(
    db, vendor, warehouse, material, material_stock_account, consumption_account, cash_account, project
):
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 50, 10))

    with pytest.raises(ValueError, match="Insufficient stock"):
        inventory_crud.create_material_issue(
            db,
            MaterialIssueCreate(
                issue_date=TODAY,
                project_id=project.id,
                warehouse_id=warehouse.id,
                lines=[MaterialIssueLineCreate(material_id=material.id, quantity=100)],
            ),
        )


def test_damaged_material_issue_posts_to_wastage_account_not_consumption(
    db, vendor, warehouse, material, material_stock_account, cash_account, project
):
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 10))

    issue = inventory_crud.create_material_issue(
        db,
        MaterialIssueCreate(
            issue_date=TODAY,
            project_id=project.id,
            warehouse_id=warehouse.id,
            reason=MaterialIssueReason.DAMAGED,
            lines=[MaterialIssueLineCreate(material_id=material.id, quantity=10)],
        ),
    )

    voucher = db.get(Voucher, issue.voucher_id)
    wastage_line = next(l for l in voucher.lines if l.debit > 0)
    assert wastage_line.account.name == "Material Wastage / Damage"


def test_delete_grn_blocked_once_stock_has_moved(
    db, vendor, warehouse, material, material_stock_account, consumption_account, cash_account, project
):
    grn = inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 10))
    inventory_crud.create_material_issue(
        db,
        MaterialIssueCreate(
            issue_date=TODAY,
            project_id=project.id,
            warehouse_id=warehouse.id,
            lines=[MaterialIssueLineCreate(material_id=material.id, quantity=10)],
        ),
    )

    with pytest.raises(ValueError, match="stock for .* has moved"):
        inventory_crud.delete_grn(db, grn)


def test_delete_grn_succeeds_when_it_is_the_latest_movement(
    db, vendor, warehouse, material, material_stock_account, cash_account
):
    grn = inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 10))
    voucher_id = grn.voucher_id

    inventory_crud.delete_grn(db, grn)

    assert db.get(Voucher, voucher_id) is None
    assert db.query(StockLedger).filter(StockLedger.ref_type == StockRefType.GRN).count() == 0


def test_material_transfer_moves_stock_between_warehouses(
    db, vendor, warehouse, warehouse_2, material, material_stock_account, cash_account
):
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 100, 10))

    inventory_crud.create_material_transfer(
        db,
        MaterialTransferCreate(
            transfer_date=TODAY,
            material_id=material.id,
            quantity=40,
            from_warehouse_id=warehouse.id,
            to_warehouse_id=warehouse_2.id,
        ),
    )

    from_qty, _ = inventory_crud._get_current_balance(db, material.id, warehouse.id)
    to_qty, to_value = inventory_crud._get_current_balance(db, material.id, warehouse_2.id)
    assert from_qty == 60
    assert to_qty == 40
    assert to_value == 400  # carried over at the source's rate (10/unit)


def test_material_transfer_rejects_insufficient_stock_at_source(
    db, vendor, warehouse, warehouse_2, material, material_stock_account, cash_account
):
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 20, 10))

    with pytest.raises(ValueError, match="Insufficient stock"):
        inventory_crud.create_material_transfer(
            db,
            MaterialTransferCreate(
                transfer_date=TODAY,
                material_id=material.id,
                quantity=50,
                from_warehouse_id=warehouse.id,
                to_warehouse_id=warehouse_2.id,
            ),
        )


def test_opening_stock_posts_balanced_voucher_and_stock_in(db, material, material_stock_account, project):
    owner_capital = Account(code="3010", name="Owner Capital", nature=AccountNature.CAPITAL)
    db.add(owner_capital)
    db.commit()

    result = inventory_crud.create_opening_stock(
        db,
        OpeningStockCreate(
            opening_date=TODAY, material_id=material.id, quantity=30, rate=5, project_id=project.id
        ),
    )

    assert result.amount == 150
    voucher = db.get(Voucher, result.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 150


def test_delete_warehouse_blocked_when_stock_movements_exist(
    db, vendor, warehouse, material, material_stock_account, cash_account
):
    inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 10, 5))

    with pytest.raises(ValueError, match="cannot be deleted"):
        inventory_crud.delete_warehouse(db, warehouse)


# ---------------------------------------------------------------------------
# Numbering never goes backwards
# ---------------------------------------------------------------------------

def test_deleted_number_is_never_reissued(db: Session):
    from app.crud import inventory as inventory_crud
    from app.schemas.inventory import VendorCreate

    v1 = inventory_crud.create_vendor(db, VendorCreate(name="A"))
    v2 = inventory_crud.create_vendor(db, VendorCreate(name="B"))
    assert (v1.vendor_code, v2.vendor_code) == ("VEN-00001", "VEN-00002")

    inventory_crud.delete_vendor(db, v2)
    v3 = inventory_crud.create_vendor(db, VendorCreate(name="C"))
    assert v3.vendor_code == "VEN-00003"  # not VEN-00002 again


def test_numbering_continues_after_existing_data(db: Session):
    from app.core.sequences import next_persistent_sequence_number
    from app.models.inventory import Vendor

    db.add(Vendor(vendor_code="VEN-00041", name="Imported"))
    db.commit()
    assert next_persistent_sequence_number(db, Vendor.vendor_code, "VEN-", 5) == "VEN-00042"


def test_issue_from_project_site_stock(
    db, vendor, material, material_stock_account, consumption_account, cash_account, project
):
    """Material a GRN delivered straight to site can be issued from that site's stock."""
    from app.models.inventory import MaterialIssueStatus
    from app.schemas.inventory import MaterialIssueCreate, MaterialIssueLineCreate

    inventory_crud.create_grn(
        db,
        GRNCreate(
            grn_date=TODAY,
            vendor_id=vendor.id,
            project_id=project.id,
            payment_account_id=cash_account.id,
            lines=[GRNLineCreate(material_id=material.id, quantity=100, rate=10)],
        ),
    )

    issue = inventory_crud.create_material_issue(
        db,
        MaterialIssueCreate(
            issue_date=TODAY,
            project_id=project.id,
            lines=[MaterialIssueLineCreate(material_id=material.id, quantity=40)],
        ),
    )

    assert issue.warehouse_id is None
    assert issue.status == MaterialIssueStatus.RECEIVED
    assert issue.lines[0].rate == 10
    last = db.query(StockLedger).order_by(StockLedger.id.desc()).first()
    assert last.warehouse_id is None and last.project_id == project.id
    assert last.balance_qty == 60

    with pytest.raises(ValueError, match="Insufficient stock"):
        inventory_crud.create_material_issue(
            db,
            MaterialIssueCreate(
                issue_date=TODAY,
                project_id=project.id,
                lines=[MaterialIssueLineCreate(material_id=material.id, quantity=61)],
            ),
        )

    inventory_crud.delete_material_issue(db, issue)
    last = db.query(StockLedger).order_by(StockLedger.id.desc()).first()
    assert last.balance_qty == 100


# GRN on credit and later vendor payments


@pytest.fixture()
def payable_account(db: Session) -> Account:
    obj = Account(code="2010", name="Accounts Payable", nature=AccountNature.LIABILITY)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def _voucher_lines(db, voucher_id):
    voucher = db.get(Voucher, voucher_id)
    return {(l.account_id, float(l.debit), float(l.credit)) for l in voucher.lines}


def test_grn_paid_in_full_by_default(db, vendor, warehouse, material, material_stock_account, cash_account):
    grn = inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 10, 100))
    assert grn.payment_status == "Paid"
    assert grn.balance == 0


def test_grn_on_credit_owes_vendor(
    db, vendor, warehouse, material, material_stock_account, cash_account, payable_account
):
    from datetime import timedelta

    grn = inventory_crud.create_grn(
        db,
        _grn(vendor, warehouse, None, material, 10, 100, amount_paid=0, payment_due_date=TODAY + timedelta(days=30)),
    )

    assert grn.payment_status == "Unpaid"
    assert grn.balance == 1_000
    assert grn.payment_account_id is None
    assert _voucher_lines(db, grn.voucher_id) == {
        (material_stock_account.id, 1_000, 0),
        (payable_account.id, 0, 1_000),
    }


def test_grn_partly_paid_then_settled(
    db, vendor, warehouse, material, material_stock_account, cash_account, payable_account
):
    from app.schemas.inventory import GRNPaymentCreate

    grn = inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 10, 100, amount_paid=300))
    assert grn.payment_status == "Partially Paid"
    assert _voucher_lines(db, grn.voucher_id) == {
        (material_stock_account.id, 1_000, 0),
        (cash_account.id, 0, 300),
        (payable_account.id, 0, 700),
    }

    with pytest.raises(ValueError, match="Only PKR 700.00 is still owed"):
        inventory_crud.create_grn_payment(
            db, grn, GRNPaymentCreate(payment_date=TODAY, amount=800, payment_account_id=cash_account.id)
        )

    grn = inventory_crud.create_grn_payment(
        db, grn, GRNPaymentCreate(payment_date=TODAY, amount=700, payment_account_id=cash_account.id)
    )
    assert grn.payment_status == "Paid"
    assert grn.balance == 0
    payment = grn.payments[0]
    assert payment.payment_no.startswith("VPY-")
    assert _voucher_lines(db, payment.voucher_id) == {
        (payable_account.id, 700, 0),
        (cash_account.id, 0, 700),
    }

    with pytest.raises(ValueError, match="Delete the vendor payments"):
        inventory_crud.delete_grn(db, grn)

    inventory_crud.delete_grn_payment(db, payment)
    db.expire_all()
    assert inventory_crud.get_grn(db, grn.id).balance == 700


def test_grn_paid_amount_needs_an_account_and_cannot_exceed_total(
    db, vendor, warehouse, material, material_stock_account, cash_account
):
    from pydantic import ValidationError

    with pytest.raises(ValidationError, match="cash / bank account"):
        _grn(vendor, warehouse, None, material, 10, 100, amount_paid=500)
    with pytest.raises(ValueError, match="more than the GRN total"):
        inventory_crud.create_grn(db, _grn(vendor, warehouse, cash_account, material, 10, 100, amount_paid=1_500))


def test_vendor_payment_settles_oldest_grns_first(
    db, vendor, warehouse, material, material_stock_account, cash_account, payable_account
):
    from datetime import timedelta

    from app.schemas.inventory import GRNPaymentCreate

    older = inventory_crud.create_grn(
        db, _grn(vendor, warehouse, cash_account, material, 10, 1_000, amount_paid=4_000, grn_date=TODAY - timedelta(days=5))
    )
    newer = inventory_crud.create_grn(db, _grn(vendor, warehouse, None, material, 5, 1_000, amount_paid=0))
    assert sum(g.balance for g in inventory_crud.vendor_unpaid_grns(db, vendor.id)) == 11_000

    with pytest.raises(ValueError, match="Only PKR 11,000.00 is owed"):
        inventory_crud.create_vendor_payment(
            db, vendor.id, GRNPaymentCreate(payment_date=TODAY, amount=12_000, payment_account_id=cash_account.id)
        )

    payments = inventory_crud.create_vendor_payment(
        db, vendor.id, GRNPaymentCreate(payment_date=TODAY, amount=8_000, payment_account_id=cash_account.id)
    )

    assert [(p.grn_no, float(p.amount)) for p in payments] == [(older.grn_no, 6_000), (newer.grn_no, 2_000)]
    db.expire_all()
    assert inventory_crud.get_grn(db, older.id).payment_status == "Paid"
    assert inventory_crud.get_grn(db, newer.id).balance == 3_000
    assert {p.vendor_name for p in inventory_crud.list_grn_payments(db, vendor_id=vendor.id)} == {vendor.name}
