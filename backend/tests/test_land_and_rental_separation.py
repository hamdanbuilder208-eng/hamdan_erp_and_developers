import pytest
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.crud import expense as expense_crud
from app.crud import land_property as land_crud
from app.crud import partner as partner_crud
from app.models.account import Account, AccountNature
from app.schemas.expense import OfficeExpenseCreate, OfficeExpenseOut
from app.schemas.land_property import LandPropertyUpdate
from tests.conftest import TODAY


@pytest.fixture()
def expense_head(db: Session) -> Account:
    obj = Account(code="5016", name="Plot Maintenance", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    return obj


def test_marking_land_sold_requires_actual_sale_price(db: Session, land_property):
    with pytest.raises(ValueError, match="actual sale price"):
        land_crud.update_land_property(db, land_property, LandPropertyUpdate(status="Sold"))


def test_marking_land_sold_records_actual_sale_price(db: Session, land_property):
    land_property.purchase_rate = 1_000_000
    land_property.sale_rate = 1_500_000  # hoped-for price at entry
    db.commit()

    result = land_crud.update_land_property(
        db, land_property, LandPropertyUpdate(status="Sold", sale_rate=1_100_000)
    )
    assert result.status.value == "Sold"
    assert float(result.sale_rate) == 1_100_000


def test_land_expense_is_kept_off_project_profit(db: Session, project, land_property, expense_head, cash_account):
    expense = expense_crud.create_office_expense(
        db,
        OfficeExpenseCreate(
            expense_date=TODAY,
            expense_head_id=expense_head.id,
            land_property_id=land_property.id,
            paid_from_id=cash_account.id,
            amount=25_000,
        ),
    )
    out = OfficeExpenseOut.model_validate(expense)
    assert out.land_property.property_ref_no == land_property.property_ref_no
    assert out.project is None
    assert [e.id for e in expense_crud.list_office_expenses(db, land_property_id=land_property.id)] == [expense.id]
    # Nothing lands on the project's books.
    assert partner_crud.compute_project_profit(db, project.id) == (0, 0)


def test_expense_cannot_target_both_project_and_land():
    with pytest.raises(ValidationError, match="either a project or a land"):
        OfficeExpenseCreate(
            expense_date=TODAY, expense_head_id=1, project_id=1, land_property_id=1, paid_from_id=2, amount=10
        )


def test_rent_from_project_unit_counts_as_project_income(
    db: Session, project, unit, tenant, cash_account, rental_income_account
):
    from app.crud import rent_receipt as rent_receipt_crud
    from app.crud import rental as rental_crud
    from app.schemas.rental import RentAgreementCreate, RentReceiptCreate

    agreement = rental_crud.create_agreement(
        db,
        RentAgreementCreate(
            agreement_date=TODAY, tenant_id=tenant.id, unit_id=unit.id,
            monthly_rent=30_000, start_date=TODAY, duration_months=3,
        ),
    )
    rent_receipt_crud.create_receipt(
        db,
        RentReceiptCreate(
            receipt_date=TODAY, agreement_id=agreement.id, credit_account_id=cash_account.id, amount=30_000
        ),
    )
    # Rent on a project's unit/shop is that project's income.
    assert partner_crud.compute_project_profit(db, project.id) == (30_000, 0)


def test_reports_split_office_land_and_project(
    db: Session, project, land_property, expense_head, cash_account
):
    from app.crud import report as report_crud

    for kwargs, amount in (({}, 1_000), ({"land_property_id": land_property.id}, 25_000), ({"project_id": project.id}, 7_000)):
        expense_crud.create_office_expense(
            db,
            OfficeExpenseCreate(
                expense_date=TODAY, expense_head_id=expense_head.id, paid_from_id=cash_account.id,
                amount=amount, **kwargs,
            ),
        )

    office = report_crud.get_profit_loss(db, scope="office")
    land = report_crud.get_profit_loss(db, scope="land")
    proj = report_crud.get_profit_loss(db, project_id=project.id)
    assert (office.total_expense, office.project_name) == (1_000, "Office / General")
    assert (land.total_expense, land.project_name) == (25_000, "Land & Plots")
    assert proj.total_expense == 7_000
    assert report_crud.get_trial_balance(db, scope="land").is_balanced


def test_land_property_report_totals(db: Session, land_property, expense_head, cash_account):
    from app.crud import report as report_crud
    from app.schemas.land_property import LandPropertyPaymentCreate

    land_property.purchase_rate = 1_000_000
    db.commit()
    land_crud.create_payment(
        db, land_property,
        LandPropertyPaymentCreate(direction="To Seller", amount=400_000, payment_date=TODAY),
    )
    expense_crud.create_office_expense(
        db,
        OfficeExpenseCreate(
            expense_date=TODAY, expense_head_id=expense_head.id, land_property_id=land_property.id,
            paid_from_id=cash_account.id, amount=25_000,
        ),
    )
    row = next(r for r in report_crud.get_land_property_report(db) if r.property_id == land_property.id)
    assert (row.paid_to_seller, row.owed_to_seller, row.expenses) == (400_000, 600_000, 25_000)
    assert row.net_cash == -425_000
