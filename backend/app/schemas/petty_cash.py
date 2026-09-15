from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.account import AccountWithBalance
from app.schemas.inventory import MaterialOut, WarehouseOut
from app.schemas.project import ProjectOut


# Float


class PettyCashFloatBase(BaseModel):
    holder_name: str


class PettyCashFloatCreate(PettyCashFloatBase):
    opening_balance: float = Field(default=0, ge=0)


class PettyCashFloatUpdate(BaseModel):
    holder_name: str | None = None
    # Sets the float's current balance directly (e.g. to correct a mistake) by
    # adjusting the underlying account's opening balance by the difference —
    # it does not touch any top-up/expense history. Can go negative (overdrawn).
    balance: float | None = None


class PettyCashFloatOut(PettyCashFloatBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    float_code: str
    is_active: bool
    account: AccountWithBalance


# Top-up


class PettyCashTopupBase(BaseModel):
    topup_date: date
    float_id: int
    amount: float = Field(gt=0)
    paid_from_id: int
    narration: str | None = None


class PettyCashTopupCreate(PettyCashTopupBase):
    pass


class PettyCashTopupOut(PettyCashTopupBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    topup_no: str
    voucher_id: int | None
    float: PettyCashFloatOut
    paid_from: AccountWithBalance


# Expense


class PettyCashExpenseBase(BaseModel):
    expense_date: date
    float_id: int
    description: str
    project_id: int | None = None
    material_id: int | None = None
    quantity: float | None = Field(default=None, gt=0)
    warehouse_id: int | None = None
    # Only meaningful when material_id is set — quantity * rate becomes the
    # amount; for a plain (non-material) spend, `amount` is given directly.
    rate: float | None = Field(default=None, ge=0)
    amount: float | None = Field(default=None, gt=0)


class PettyCashExpenseCreate(PettyCashExpenseBase):
    @model_validator(mode="after")
    def validate_amount(self):
        if self.material_id is not None:
            if self.quantity is None or self.rate is None:
                raise ValueError("Quantity and rate are required for a material purchase")
        elif self.amount is None:
            raise ValueError("Amount is required")
        return self


class PettyCashExpenseOut(PettyCashExpenseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    expense_no: str
    amount: float
    voucher_id: int | None
    float: PettyCashFloatOut
    project: ProjectOut | None = None
    material: MaterialOut | None = None
    warehouse: WarehouseOut | None = None
