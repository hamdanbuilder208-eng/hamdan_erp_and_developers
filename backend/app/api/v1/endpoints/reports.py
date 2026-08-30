from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import inventory as inventory_crud
from app.crud import report as report_crud
from app.db.session import get_db
from app.schemas.inventory import StockBalanceOut
from app.schemas.report import (
    AgingReport,
    BalanceSheetReport,
    BrokerSummaryRow,
    CustomerWiseReport,
    EmployeeSummaryRow,
    GeneralLedgerReport,
    MaterialSummaryRow,
    PartnerSummaryRow,
    ProfitLossReport,
    SalesPurchaseReport,
    StockLedgerReport,
    TrialBalanceReport,
)

router = APIRouter()


@router.get("/trial-balance", response_model=TrialBalanceReport)
def trial_balance(db: Session = Depends(get_db)):
    return report_crud.get_trial_balance(db)


@router.get("/profit-loss", response_model=ProfitLossReport)
def profit_loss(
    project_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    return report_crud.get_profit_loss(db, project_id=project_id, date_from=date_from, date_to=date_to)


@router.get("/balance-sheet", response_model=BalanceSheetReport)
def balance_sheet(db: Session = Depends(get_db)):
    return report_crud.get_balance_sheet(db)


@router.get("/general-ledger/{account_id}", response_model=GeneralLedgerReport)
def general_ledger(
    account_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    report = report_crud.get_general_ledger(db, account_id, date_from=date_from, date_to=date_to)
    if not report:
        raise HTTPException(status_code=404, detail="Account not found")
    return report


@router.get("/aging", response_model=AgingReport)
def aging_report(as_of_date: date | None = None, db: Session = Depends(get_db)):
    return report_crud.get_aging_report(db, as_of_date=as_of_date)


@router.get("/sales-purchase", response_model=SalesPurchaseReport)
def sales_purchase_report(
    date_from: date | None = None,
    date_to: date | None = None,
    project_id: int | None = None,
    db: Session = Depends(get_db),
):
    return report_crud.get_sales_purchase_report(
        db, date_from=date_from, date_to=date_to, project_id=project_id
    )


@router.get("/stock", response_model=list[StockBalanceOut])
def stock_report(
    project_id: int | None = None, material_id: int | None = None, db: Session = Depends(get_db)
):
    return inventory_crud.get_stock_balances(db, project_id=project_id, material_id=material_id)


@router.get("/stock/ledger/{material_id}", response_model=StockLedgerReport)
def stock_ledger_report(
    material_id: int,
    project_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    report = report_crud.get_stock_ledger_report(
        db, material_id, project_id=project_id, date_from=date_from, date_to=date_to
    )
    if not report:
        raise HTTPException(status_code=404, detail="Material not found")
    return report


@router.get("/customer-wise", response_model=CustomerWiseReport)
def customer_wise_report(db: Session = Depends(get_db)):
    return report_crud.get_customer_wise_report(db)


@router.get("/brokers", response_model=list[BrokerSummaryRow])
def brokers_report(db: Session = Depends(get_db)):
    return report_crud.get_all_broker_summaries(db)


@router.get("/partners", response_model=list[PartnerSummaryRow])
def partners_report(db: Session = Depends(get_db)):
    return report_crud.get_all_partner_summaries(db)


@router.get("/materials", response_model=list[MaterialSummaryRow])
def materials_report(db: Session = Depends(get_db)):
    return report_crud.get_material_summary_report(db)


@router.get("/employees", response_model=list[EmployeeSummaryRow])
def employees_report(db: Session = Depends(get_db)):
    return report_crud.get_employee_summary_report(db)
