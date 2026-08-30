from datetime import date

from pydantic import BaseModel, ConfigDict

from app.schemas.account import AccountOut
from app.schemas.allottee import AllotteeOut
from app.schemas.booking_agent import BookingAgentOut
from app.schemas.project import ProjectOut
from app.schemas.unit import UnitOut


class PayoutBookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    booking_ref_no: str
    project: ProjectOut
    unit: UnitOut
    allottee: AllotteeOut


class CommissionPayoutBase(BaseModel):
    payout_date: date
    booking_id: int
    agent_id: int
    credit_account_id: int
    amount: float
    narration: str | None = None


class CommissionPayoutCreate(CommissionPayoutBase):
    pass


class CommissionPayoutOut(CommissionPayoutBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    payout_no: str
    voucher_id: int | None
    agent: BookingAgentOut
    credit_account: AccountOut
    booking: PayoutBookingOut
