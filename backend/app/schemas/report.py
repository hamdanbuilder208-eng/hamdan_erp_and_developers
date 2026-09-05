from datetime import date

from pydantic import BaseModel


class TrialBalanceRow(BaseModel):
    account_id: int
    code: str
    name: str
    nature: str
    debit: float
    credit: float


class TrialBalanceReport(BaseModel):
    rows: list[TrialBalanceRow]
    total_debit: float
    total_credit: float
    is_balanced: bool


class ProfitLossLine(BaseModel):
    account_id: int
    code: str
    name: str
    amount: float


class ProfitLossReport(BaseModel):
    revenue_lines: list[ProfitLossLine]
    expense_lines: list[ProfitLossLine]
    total_revenue: float
    total_expense: float
    net_profit: float
    project_id: int | None = None
    project_name: str | None = None
    date_from: date | None = None
    date_to: date | None = None


class BalanceSheetLine(BaseModel):
    account_id: int
    code: str
    name: str
    amount: float


class BalanceSheetReport(BaseModel):
    assets: list[BalanceSheetLine]
    liabilities: list[BalanceSheetLine]
    capital: list[BalanceSheetLine]
    total_assets: float
    total_liabilities: float
    total_capital_before_profit: float
    retained_earnings: float
    total_capital: float
    is_balanced: bool


class GeneralLedgerLine(BaseModel):
    voucher_id: int
    voucher_no: str
    voucher_date: date
    voucher_type: str
    narration: str | None
    debit: float
    credit: float
    running_balance: float


class GeneralLedgerReport(BaseModel):
    account_id: int
    account_code: str
    account_name: str
    opening_balance: float
    lines: list[GeneralLedgerLine]
    closing_balance: float


# Aging


class AgingRow(BaseModel):
    booking_id: int
    booking_ref_no: str
    allottee_name: str
    project_name: str
    bucket_0_30: float
    bucket_31_60: float
    bucket_61_90: float
    bucket_90_plus: float
    total_outstanding: float


class AgingReport(BaseModel):
    as_of_date: date
    rows: list[AgingRow]
    total_0_30: float
    total_31_60: float
    total_61_90: float
    total_90_plus: float
    grand_total: float


# Sales / Purchase


class SalesPurchaseReport(BaseModel):
    date_from: date | None = None
    date_to: date | None = None
    project_id: int | None = None
    sales_count: int
    sales_total: float
    purchase_count: int
    purchase_total: float


# Stock ledger


class StockLedgerRow(BaseModel):
    movement_date: date
    movement_type: str
    ref_type: str
    ref_id: int
    quantity: float
    rate: float
    amount: float
    balance_qty: float
    balance_value: float


class StockLedgerReport(BaseModel):
    material_id: int
    material_code: str
    material_name: str
    unit_of_measure: str
    project_id: int | None
    opening_qty: float
    opening_value: float
    lines: list[StockLedgerRow]
    closing_qty: float
    closing_value: float


# Customer-wise


class CustomerWiseRow(BaseModel):
    allottee_id: int
    allottee_code: str
    name: str
    bookings_count: int
    total_booked: float
    total_received: float
    balance: float


class CustomerWiseReport(BaseModel):
    rows: list[CustomerWiseRow]
    grand_total_booked: float
    grand_total_received: float
    grand_total_balance: float


# Broker / Partner


class BrokerSummaryRow(BaseModel):
    agent_id: int
    agent_code: str
    name: str
    total_eligible: float
    total_paid: float
    total_balance: float


class PartnerSummaryRow(BaseModel):
    partner_id: int
    partner_code: str
    name: str
    total_share_amount: float
    total_drawn: float
    total_balance: float
    total_contributed: float
    total_distributable_share: float
    total_partner_expense: float
    total_current_account_balance: float


# Material / Employee


class MaterialSummaryRow(BaseModel):
    material_id: int
    material_code: str
    name: str
    unit_of_measure: str
    total_purchased_qty: float
    total_purchased_value: float
    total_issued_qty: float
    total_issued_value: float
    current_balance_qty: float
    current_balance_value: float


class EmployeeSummaryRow(BaseModel):
    employee_id: int
    employee_code: str
    name: str
    designation: str | None
    wage_type: str
    total_paid: float
    payment_count: int
    last_payment_date: date | None
