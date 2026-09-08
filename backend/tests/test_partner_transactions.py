import pytest
from sqlalchemy.orm import Session

from app.crud import partner as partner_crud
from app.crud import partner_contribution as contribution_crud
from app.crud import partner_drawing as drawing_crud
from app.crud import partner_expense as partner_expense_crud
from app.models.account import Account, AccountNature
from app.models.voucher import Voucher
from app.schemas.partner import (
    PartnerContributionCreate,
    PartnerDrawingCreate,
    PartnerExpenseCreate,
    ProjectPartnerShareCreate,
)
from tests.conftest import TODAY


@pytest.fixture()
def equity_account(db: Session) -> Account:
    obj = Account(code="3020", name="Partner Equity", nature=AccountNature.CAPITAL)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def payable_account(db: Session) -> Account:
    obj = Account(code="2030", name="Partner Payable", nature=AccountNature.LIABILITY)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def revenue_account(db: Session) -> Account:
    obj = Account(code="4010", name="Unit Sales", nature=AccountNature.REVENUE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# Contribution


def test_create_contribution_posts_balanced_voucher(
    db: Session, partner, project, equity_account, cash_account
):
    result = contribution_crud.create_contribution(
        db,
        PartnerContributionCreate(
            contribution_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            debit_account_id=cash_account.id,
            amount=200_000,
        ),
    )

    voucher = db.get(Voucher, result.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 200_000


def test_create_contribution_requires_equity_account_in_chart(db: Session, partner, project, cash_account):
    with pytest.raises(ValueError, match="Partner Equity account"):
        contribution_crud.create_contribution(
            db,
            PartnerContributionCreate(
                contribution_date=TODAY,
                partner_id=partner.id,
                project_id=project.id,
                debit_account_id=cash_account.id,
                amount=200_000,
            ),
        )


def test_delete_contribution_removes_voucher(
    db: Session, partner, project, equity_account, cash_account
):
    result = contribution_crud.create_contribution(
        db,
        PartnerContributionCreate(
            contribution_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            debit_account_id=cash_account.id,
            amount=200_000,
        ),
    )
    voucher_id = result.voucher_id

    contribution_crud.delete_contribution(db, result)

    assert db.get(Voucher, voucher_id) is None


# Partner expense (paid on company's behalf)


def test_create_partner_expense_posts_balanced_voucher(
    db: Session, partner, project, payable_account, cash_account
):
    result = partner_expense_crud.create_expense(
        db,
        PartnerExpenseCreate(
            expense_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            expense_account_id=cash_account.id,
            amount=30_000,
        ),
    )

    voucher = db.get(Voucher, result.voucher_id)
    assert sum(l.debit for l in voucher.lines) == sum(l.credit for l in voucher.lines) == 30_000


def test_create_partner_expense_requires_payable_account_in_chart(
    db: Session, partner, project, cash_account
):
    with pytest.raises(ValueError, match="Partner Payable account"):
        partner_expense_crud.create_expense(
            db,
            PartnerExpenseCreate(
                expense_date=TODAY,
                partner_id=partner.id,
                project_id=project.id,
                expense_account_id=cash_account.id,
                amount=30_000,
            ),
        )


def test_delete_partner_expense_removes_voucher(
    db: Session, partner, project, payable_account, cash_account
):
    result = partner_expense_crud.create_expense(
        db,
        PartnerExpenseCreate(
            expense_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            expense_account_id=cash_account.id,
            amount=30_000,
        ),
    )
    voucher_id = result.voucher_id

    partner_expense_crud.delete_expense(db, result)

    assert db.get(Voucher, voucher_id) is None


# Drawing


def _give_partner_a_balance(db, project, partner, revenue_account, share_percent=50):
    """Posts revenue and a project share so the partner has a positive
    `balance` (share_amount - drawn) for create_drawing's check to allow against."""
    from app.models.voucher import Voucher as VoucherModel
    from app.models.voucher import VoucherLine, VoucherType

    suspense = Account(code="9999", name="Suspense", nature=AccountNature.ASSET)
    db.add(suspense)
    db.flush()
    voucher = VoucherModel(
        voucher_no="JV-SETUP-1", voucher_type=VoucherType.JOURNAL, voucher_date=TODAY, project_id=project.id
    )
    db.add(voucher)
    db.flush()
    db.add(VoucherLine(voucher_id=voucher.id, account_id=revenue_account.id, debit=0, credit=1_000_000))
    db.add(VoucherLine(voucher_id=voucher.id, account_id=suspense.id, debit=1_000_000, credit=0))
    db.commit()

    partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=partner.id, share_percent=share_percent)
    )


def test_create_drawing_within_balance_succeeds(
    db: Session, partner, project, revenue_account, equity_account, cash_account
):
    _give_partner_a_balance(db, project, partner, revenue_account)  # balance = 500,000

    drawing = drawing_crud.create_drawing(
        db,
        PartnerDrawingCreate(
            drawing_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            credit_account_id=cash_account.id,
            amount=200_000,
        ),
    )
    assert drawing.amount == 200_000


def test_create_drawing_rejects_amount_over_balance(
    db: Session, partner, project, revenue_account, equity_account, cash_account
):
    _give_partner_a_balance(db, project, partner, revenue_account)  # balance = 500,000

    with pytest.raises(ValueError, match="exceeds the partner's balance"):
        drawing_crud.create_drawing(
            db,
            PartnerDrawingCreate(
                drawing_date=TODAY,
                partner_id=partner.id,
                project_id=project.id,
                credit_account_id=cash_account.id,
                amount=600_000,
            ),
        )


def test_create_drawing_rejects_project_with_no_share(db: Session, partner, project, cash_account):
    with pytest.raises(ValueError, match="no share configured"):
        drawing_crud.create_drawing(
            db,
            PartnerDrawingCreate(
                drawing_date=TODAY,
                partner_id=partner.id,
                project_id=project.id,
                credit_account_id=cash_account.id,
                amount=10_000,
            ),
        )


def test_delete_drawing_removes_voucher(
    db: Session, partner, project, revenue_account, equity_account, cash_account
):
    _give_partner_a_balance(db, project, partner, revenue_account)
    drawing = drawing_crud.create_drawing(
        db,
        PartnerDrawingCreate(
            drawing_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            credit_account_id=cash_account.id,
            amount=200_000,
        ),
    )
    voucher_id = drawing.voucher_id

    drawing_crud.delete_drawing(db, drawing)

    assert db.get(Voucher, voucher_id) is None
