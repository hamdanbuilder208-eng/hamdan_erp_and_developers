import pytest
from sqlalchemy.orm import Session

from app.crud import partner as partner_crud
from app.models.account import Account, AccountNature
from app.models.partner import PartnerContribution, PartnerDrawing, PartnerExpense
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.partner import PartnerCreate, ProjectPartnerShareCreate
from tests.conftest import TODAY


@pytest.fixture()
def revenue_account(db: Session) -> Account:
    obj = Account(code="4010", name="Unit Sales", nature=AccountNature.REVENUE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@pytest.fixture()
def expense_account(db: Session) -> Account:
    obj = Account(code="5010", name="Construction Cost", nature=AccountNature.EXPENSE)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def _post_journal(db: Session, project, revenue_account=None, revenue=0, expense_account=None, expense=0):
    """Books revenue/expense the same way real vouchers do: a REVENUE account
    is credited, an EXPENSE account is debited, balanced by an equal-and-
    opposite line on an arbitrary asset account (the balancing side doesn't
    matter for compute_project_profit, which only reads REVENUE/EXPENSE lines)."""
    suspense = Account(code=f"9999-{project.id}-{revenue}-{expense}", name="Suspense", nature=AccountNature.ASSET)
    db.add(suspense)
    db.flush()
    voucher = Voucher(
        voucher_no=f"JV-TEST-{project.id}-{revenue}-{expense}",
        voucher_type=VoucherType.JOURNAL,
        voucher_date=TODAY,
        project_id=project.id,
    )
    db.add(voucher)
    db.flush()
    if revenue:
        db.add(VoucherLine(voucher_id=voucher.id, account_id=revenue_account.id, debit=0, credit=revenue))
        db.add(VoucherLine(voucher_id=voucher.id, account_id=suspense.id, debit=revenue, credit=0))
    if expense:
        db.add(VoucherLine(voucher_id=voucher.id, account_id=expense_account.id, debit=expense, credit=0))
        db.add(VoucherLine(voucher_id=voucher.id, account_id=suspense.id, debit=0, credit=expense))
    db.commit()


def test_add_project_share_rejects_over_100_percent(db: Session, project, partner):
    partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=partner.id, share_percent=60)
    )
    other_partner = partner_crud.create_partner(db, PartnerCreate(name="Other Partner"))

    with pytest.raises(ValueError, match="cannot exceed 100"):
        partner_crud.add_project_share(
            db, project.id, ProjectPartnerShareCreate(partner_id=other_partner.id, share_percent=50)
        )


def test_add_project_share_allows_exactly_100_percent(db: Session, project, partner):
    partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=partner.id, share_percent=60)
    )
    other_partner = partner_crud.create_partner(db, PartnerCreate(name="Other Partner"))

    share = partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=other_partner.id, share_percent=40)
    )
    assert share.share_percent == 40


def test_compute_project_profit_sums_revenue_minus_expense(
    db: Session, project, revenue_account, expense_account
):
    _post_journal(db, project, revenue_account, 1_000_000, expense_account, 400_000)

    revenue, expense = partner_crud.compute_project_profit(db, project.id)
    assert revenue == 1_000_000
    assert expense == 400_000


def test_partner_summary_share_amount_is_percent_of_net_profit(
    db: Session, project, partner, revenue_account, expense_account
):
    _post_journal(db, project, revenue_account, 1_000_000, expense_account, 400_000)
    partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=partner.id, share_percent=40)
    )

    summary = partner_crud.get_partner_summary(db, partner.id)
    row = summary.projects[0]

    assert row.project_net_profit == 600_000
    assert row.partner_share_amount == 240_000  # 40% of 600,000


def test_partner_summary_balance_deducts_drawings(
    db: Session, project, partner, revenue_account, expense_account, cash_account
):
    _post_journal(db, project, revenue_account, 1_000_000, expense_account, 0)
    partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=partner.id, share_percent=50)
    )
    db.add(
        PartnerDrawing(
            drawing_no="DRW-00001",
            drawing_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            credit_account_id=cash_account.id,
            amount=100_000,
        )
    )
    db.commit()

    summary = partner_crud.get_partner_summary(db, partner.id)
    row = summary.projects[0]

    assert row.partner_share_amount == 500_000  # 50% of 1,000,000
    assert row.drawn_amount == 100_000
    assert row.balance == 400_000


def test_partner_summary_current_account_balance_combines_all_movements(
    db: Session, project, partner, revenue_account, expense_account, cash_account
):
    """current_account_balance = contributed - drawn + profit share + partner_expense."""
    _post_journal(db, project, revenue_account, 1_000_000, expense_account, 0)
    partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=partner.id, share_percent=50)
    )
    db.add(
        PartnerContribution(
            contribution_no="CTB-00001",
            contribution_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            debit_account_id=cash_account.id,
            amount=200_000,
        )
    )
    db.add(
        PartnerExpense(
            expense_no="PEX-00001",
            expense_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            expense_account_id=cash_account.id,
            amount=30_000,
        )
    )
    db.add(
        PartnerDrawing(
            drawing_no="DRW-00001",
            drawing_date=TODAY,
            partner_id=partner.id,
            project_id=project.id,
            credit_account_id=cash_account.id,
            amount=100_000,
        )
    )
    db.commit()

    summary = partner_crud.get_partner_summary(db, partner.id)
    row = summary.projects[0]

    # contributed(200k) - drawn(100k) + share(500k) + partner_expense(30k)
    assert row.current_account_balance == 630_000


def test_partner_summary_reserve_holds_back_unfinished_construction_budget(
    db: Session, project, partner, revenue_account, expense_account
):
    """Only revenue beyond the budget still needed for construction is
    distributable — spending more only shrinks the reserve, not the profit
    numbers, which are independent of the budget."""
    project.total_budget = 800_000
    db.commit()
    _post_journal(db, project, revenue_account, 1_000_000, expense_account, 300_000)
    partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=partner.id, share_percent=50)
    )

    summary = partner_crud.get_partner_summary(db, partner.id)
    row = summary.projects[0]

    assert row.reserve_amount == 500_000  # 800,000 budget - 300,000 spent so far
    assert row.distributable_amount == 500_000  # 1,000,000 revenue - 500,000 reserve
    assert row.partner_distributable_share == 250_000  # 50% of distributable


def test_delete_partner_blocked_while_shares_exist(db: Session, project, partner):
    partner_crud.add_project_share(
        db, project.id, ProjectPartnerShareCreate(partner_id=partner.id, share_percent=50)
    )

    with pytest.raises(ValueError, match="share in"):
        partner_crud.delete_partner(db, partner)
