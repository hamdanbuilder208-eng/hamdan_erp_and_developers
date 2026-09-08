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
        payment_account_id=payment_account.id,
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
