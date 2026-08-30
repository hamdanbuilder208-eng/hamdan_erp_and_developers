from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.expense import WageType
from app.schemas.account import AccountOut
from app.schemas.project import ProjectOut


# Office Expense


class OfficeExpenseBase(BaseModel):
    expense_date: date
    expense_head_id: int
    project_id: int | None = None
    paid_from_id: int
    amount: float
    narration: str | None = None


class OfficeExpenseCreate(OfficeExpenseBase):
    pass


class OfficeExpenseOut(OfficeExpenseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    expense_no: str
    voucher_id: int | None
    expense_head: AccountOut
    paid_from: AccountOut
    project: ProjectOut | None = None


# Employee


class EmployeeBase(BaseModel):
    name: str
    designation: str | None = None
    site_department: str | None = None
    cnic: str | None = None
    contact: str | None = None
    wage_type: WageType = WageType.MONTHLY
    rate: float = 0
    is_active: bool = True


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(BaseModel):
    name: str | None = None
    designation: str | None = None
    site_department: str | None = None
    cnic: str | None = None
    contact: str | None = None
    wage_type: WageType | None = None
    rate: float | None = None
    is_active: bool | None = None


class EmployeeOut(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    employee_code: str


# Wage Payment


class WagePaymentBase(BaseModel):
    payment_date: date
    employee_id: int
    period_from: date
    period_to: date
    days_or_units: float | None = None
    gross_amount: float
    advances_deductions: float = 0
    paid_from_id: int
    narration: str | None = None


class WagePaymentCreate(WagePaymentBase):
    pass


class WagePaymentOut(WagePaymentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    payment_no: str
    net_paid: float
    voucher_id: int | None
    employee: EmployeeOut
    paid_from: AccountOut


# Owner Personal Expense


class OwnerPersonalExpenseBase(BaseModel):
    expense_date: date
    category: str
    source_account_id: int
    amount: float
    remarks: str | None = None


class OwnerPersonalExpenseCreate(OwnerPersonalExpenseBase):
    pass


class OwnerPersonalExpenseOut(OwnerPersonalExpenseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    expense_no: str
    voucher_id: int | None
    source_account: AccountOut
