from pydantic import BaseModel, ConfigDict

from app.models.account import AccountNature, PartyType


class AccountBase(BaseModel):
    name: str
    parent_id: int | None = None
    nature: AccountNature
    is_control: bool = False
    party_type: PartyType | None = None
    opening_debit: float = 0
    opening_credit: float = 0
    credit_days: int | None = None
    is_active: bool = True


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    nature: AccountNature | None = None
    is_control: bool | None = None
    party_type: PartyType | None = None
    opening_debit: float | None = None
    opening_credit: float | None = None
    credit_days: int | None = None
    is_active: bool | None = None


class AccountOut(AccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str


class AccountWithBalance(AccountOut):
    balance: float = 0
