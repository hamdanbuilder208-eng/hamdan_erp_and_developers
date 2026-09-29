from sqlalchemy.orm import Session

from app.crud import account as account_crud
from app.crud import report as report_crud
from app.models.account import Account, AccountNature
from app.models.project import Project
from app.models.voucher import Voucher, VoucherLine, VoucherType
from tests.conftest import TODAY


def _post(db, project_id, debit_acc, credit_acc, amount, no):
    v = Voucher(voucher_no=no, voucher_type=VoucherType.JOURNAL, voucher_date=TODAY, project_id=project_id)
    db.add(v)
    db.flush()
    db.add_all([
        VoucherLine(voucher_id=v.id, account_id=debit_acc.id, debit=amount, credit=0),
        VoucherLine(voucher_id=v.id, account_id=credit_acc.id, debit=0, credit=amount),
    ])
    db.commit()


def _setup(db, project):
    other = Project(project_code="PRJ-002", project_name="Other Project")
    bank = Account(code="1011", name="Bank", nature=AccountNature.ASSET, opening_debit=1_000_000, opening_credit=0)
    sales = Account(code="4011", name="Sales", nature=AccountNature.REVENUE)
    site = Account(code="5071", name="Site Expense", nature=AccountNature.EXPENSE)
    db.add_all([other, bank, sales, site])
    db.commit()
    _post(db, project.id, bank, sales, 500_000, "JV-A1")
    _post(db, project.id, site, bank, 100_000, "JV-A2")
    _post(db, other.id, bank, sales, 900_000, "JV-B1")
    return other, bank, sales, site


def test_trial_balance_for_one_project(db: Session, project):
    other, bank, sales, site = _setup(db, project)
    tb = report_crud.get_trial_balance(db, project_id=project.id)
    by_code = {r.code: (r.debit, r.credit) for r in tb.rows}
    assert by_code["1011"] == (400_000, 0)  # 500k in − 100k out, no company opening balance
    assert by_code["4011"] == (0, 500_000)  # other project's 900k sale excluded
    assert tb.is_balanced


def test_balance_sheet_for_one_project_balances(db: Session, project):
    _setup(db, project)
    bs = report_crud.get_balance_sheet(db, project_id=project.id)
    assert bs.retained_earnings == 400_000
    assert bs.is_balanced


def test_general_ledger_and_chart_of_accounts_for_one_project(db: Session, project):
    other, bank, sales, site = _setup(db, project)
    gl = report_crud.get_general_ledger(db, bank.id, project_id=project.id)
    assert gl.opening_balance == 0
    assert [l.voucher_no for l in gl.lines] == ["JV-A1", "JV-A2"]
    assert gl.closing_balance == 400_000
    assert account_crud.account_balance(db, bank.id, project_id=other.id) == 900_000
    # Company-wide view is unchanged: opening + everything posted.
    assert account_crud.account_balance(db, bank.id) == 1_000_000 + 500_000 - 100_000 + 900_000
