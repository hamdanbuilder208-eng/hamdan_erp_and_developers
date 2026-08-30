from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.voucher import VoucherType
from app.schemas.account import AccountOut


class VoucherLineBase(BaseModel):
    account_id: int
    debit: float = 0
    credit: float = 0
    narration: str | None = None


class VoucherLineCreate(VoucherLineBase):
    pass


class VoucherLineOut(VoucherLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account: AccountOut


class VoucherBase(BaseModel):
    voucher_type: VoucherType
    voucher_date: date
    project_id: int | None = None
    narration: str | None = None


class VoucherCreate(VoucherBase):
    lines: list[VoucherLineCreate]

    @model_validator(mode="after")
    def validate_balanced(self):
        total_debit = sum(line.debit for line in self.lines)
        total_credit = sum(line.credit for line in self.lines)
        if len(self.lines) < 2:
            raise ValueError("A voucher needs at least two lines (debit and credit)")
        if round(total_debit, 2) != round(total_credit, 2):
            raise ValueError(
                f"Voucher is not balanced: total debit {total_debit} != total credit {total_credit}"
            )
        return self


class VoucherOut(VoucherBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    voucher_no: str
    lines: list[VoucherLineOut]
