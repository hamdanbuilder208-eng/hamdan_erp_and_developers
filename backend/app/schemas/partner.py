from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.account import AccountOut


class PartnerBase(BaseModel):
    name: str
    contact_info: str | None = None
    linked_account_id: int | None = None


class PartnerCreate(PartnerBase):
    pass


class PartnerUpdate(BaseModel):
    name: str | None = None
    contact_info: str | None = None
    linked_account_id: int | None = None


class PartnerOut(PartnerBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    partner_code: str
    linked_account: AccountOut | None = None


class ProjectPartnerShareBase(BaseModel):
    partner_id: int
    investment_amount: float = 0
    share_percent: float
    retention_percent: float = Field(default=0, ge=0, le=100)


class ProjectPartnerShareCreate(ProjectPartnerShareBase):
    pass


class ProjectPartnerShareUpdate(BaseModel):
    retention_percent: float = Field(ge=0, le=100)


class ProjectPartnerShareOut(ProjectPartnerShareBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    partner: PartnerOut


class PartnerContributionBase(BaseModel):
    contribution_date: date
    partner_id: int
    project_id: int
    debit_account_id: int
    amount: float
    purpose: str | None = None
    narration: str | None = None


class PartnerContributionCreate(PartnerContributionBase):
    pass


class PartnerContributionOut(PartnerContributionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    contribution_no: str
    voucher_id: int | None
    partner: PartnerOut
    debit_account: AccountOut


class PartnerExpenseBase(BaseModel):
    expense_date: date
    partner_id: int
    project_id: int
    expense_account_id: int
    amount: float
    narration: str | None = None


class PartnerExpenseCreate(PartnerExpenseBase):
    pass


class PartnerExpenseOut(PartnerExpenseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    expense_no: str
    voucher_id: int | None
    partner: PartnerOut
    expense_account: AccountOut


class PartnerDrawingBase(BaseModel):
    drawing_date: date
    partner_id: int
    project_id: int
    credit_account_id: int
    amount: float
    narration: str | None = None


class PartnerDrawingCreate(PartnerDrawingBase):
    pass


class PartnerDrawingOut(PartnerDrawingBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    drawing_no: str
    voucher_id: int | None
    partner: PartnerOut
    credit_account: AccountOut


class PartnerProjectRow(BaseModel):
    project_id: int
    project_name: str
    share_percent: float
    investment_amount: float
    contributed_amount: float
    project_revenue: float
    project_expense: float
    project_net_profit: float
    partner_share_amount: float
    drawn_amount: float
    balance: float
    construction_budget: float | None
    reserve_amount: float
    distributable_amount: float
    partner_distributable_share: float
    partner_expense_amount: float
    current_account_balance: float
    # Pledged investment not yet paid in (e.g. pledged 2cr, contributed 1cr → 1cr pending).
    pending_investment: float = 0
    # Company backup policy (advisory): part of the profit share kept with the company.
    retention_percent: float = 0
    retained_amount: float = 0
    withdrawable_per_policy: float = 0


class PartnerSummary(BaseModel):
    partner: PartnerOut
    projects: list[PartnerProjectRow]
    total_share_amount: float
    total_drawn: float
    total_balance: float
    total_contributed: float
    total_distributable_share: float
    total_partner_expense: float
    total_current_account_balance: float
