from datetime import date

import pytest
from sqlalchemy.orm import Session

from app.crud import inventory as inventory_crud
from app.crud import receipt as receipt_crud
from app.crud.period_report import LOADERS, get_period_report, period_bounds
from app.models.account import Account, AccountNature
from app.models.receipt import ChequeStatus
from app.schemas.inventory import GRNCreate, GRNLineCreate, MaterialCreate, VendorCreate, WarehouseCreate
from app.schemas.receipt import ReceiptCreate


@pytest.fixture()
def stock_setup(db: Session):
    db.add(Account(code="1040", name="Material Stock", nature=AccountNature.ASSET))
    db.commit()
    return dict(
        vendor=inventory_crud.create_vendor(db, VendorCreate(name="ABC Traders")),
        warehouse=inventory_crud.create_warehouse(db, WarehouseCreate(name="Main Store")),
        cement=inventory_crud.create_material(db, MaterialCreate(name="Cement", unit_of_measure="Bag")),
        steel=inventory_crud.create_material(db, MaterialCreate(name="Steel", unit_of_measure="Ton")),
    )


def _buy(db, s, cash_account, material, qty, rate, on: date, mode="Cash", project=None):
    inventory_crud.create_grn(
        db,
        GRNCreate(
            grn_date=on,
            vendor_id=s["vendor"].id,
            warehouse_id=s["warehouse"].id,
            project_id=project.id if project else None,
            payment_account_id=cash_account.id,
            mode_of_payment=mode,
            **({"cheque_no": "1", "cheque_bank_name": "HBL"} if mode == "Cheque" else {}),
            lines=[GRNLineCreate(material_id=material.id, quantity=qty, rate=rate)],
        ),
    )


def test_period_bounds():
    d = date(2026, 3, 18)  # a Wednesday
    assert period_bounds(d, "day")[:2] == (d, d)
    assert period_bounds(d, "week")[:2] == (date(2026, 3, 16), date(2026, 3, 22))
    assert period_bounds(d, "month")[:2] == (date(2026, 3, 1), date(2026, 3, 31))
    assert period_bounds(date(2026, 2, 10), "month")[1] == date(2026, 2, 28)
    assert period_bounds(d, "year")[:2] == (date(2026, 1, 1), date(2026, 12, 31))


def test_cement_bags_per_month_filtered_by_item_and_mode(
    db: Session, stock_setup, cash_account, project
):
    s = stock_setup
    _buy(db, s, cash_account, s["cement"], 100, 1_000, date(2026, 1, 5), project=project)
    _buy(db, s, cash_account, s["cement"], 50, 1_000, date(2026, 1, 20), project=project)
    _buy(db, s, cash_account, s["cement"], 70, 1_000, date(2026, 2, 3), project=project)
    _buy(db, s, cash_account, s["cement"], 999, 1_000, date(2026, 2, 4), mode="Cheque", project=project)
    _buy(db, s, cash_account, s["steel"], 2, 200_000, date(2026, 1, 9), project=project)

    report = get_period_report(
        db,
        category="material_purchases",
        period="month",
        project_id=project.id,
        item="Cement",
        payment_mode="Cash",
    )

    assert [(r.period_label, r.quantity, r.unit, r.amount) for r in report.rows] == [
        ("Jan 2026", 150, "Bag", 150_000),
        ("Feb 2026", 70, "Bag", 70_000),
    ]
    assert report.total_quantity == 220
    assert report.total_amount == 220_000
    assert report.items == ["Cement", "Steel"]
    assert set(report.payment_modes) == {"Cash", "Cheque"}


def test_mixed_units_have_no_quantity_but_group_by_item_does(
    db: Session, stock_setup, cash_account
):
    s = stock_setup
    _buy(db, s, cash_account, s["cement"], 10, 1_000, date(2026, 1, 5))
    _buy(db, s, cash_account, s["steel"], 1, 200_000, date(2026, 1, 6))

    plain = get_period_report(db, category="material_purchases", period="year")
    assert plain.rows[0].quantity is None
    assert plain.total_quantity is None
    assert plain.total_amount == 210_000

    by_item = get_period_report(db, category="material_purchases", period="year", group_by="item")
    assert [(r.group, r.quantity, r.unit) for r in by_item.rows] == [
        ("Cement", 10, "Bag"),
        ("Steel", 1, "Ton"),
    ]


def test_customer_receipts_skip_bounced_cheques(db: Session, booking, cash_account):
    def receive(amount, **kw):
        return receipt_crud.create_receipt(
            db,
            ReceiptCreate(
                receipt_date=date(2026, 5, 4),
                booking_id=booking.id,
                credit_account_id=cash_account.id,
                amount=amount,
                **kw,
            ),
        )

    receive(100_000)
    bounced = receive(
        50_000,
        mode_of_payment="Cheque",
        cheque_no="1",
        cheque_bank_name="HBL",
        cheque_date=date(2026, 5, 4),
        cheque_clearing_date=date(2026, 5, 4),
    )
    receipt_crud.mark_cheque_status(db, bounced, ChequeStatus.BOUNCED)

    report = get_period_report(db, category="customer_receipts", period="week", group_by="payment_mode")

    assert [(r.group, r.amount) for r in report.rows] == [("Cash", 100_000)]
    assert report.rows[0].period_label.startswith("Week 19, 2026")


@pytest.mark.parametrize("category", list(LOADERS))
def test_every_category_runs_with_all_groupings(db: Session, category):
    for group_by in (None, "project", "item", "payment_mode", "party"):
        report = get_period_report(db, category=category, period="month", group_by=group_by)
        assert report.total_amount == 0
