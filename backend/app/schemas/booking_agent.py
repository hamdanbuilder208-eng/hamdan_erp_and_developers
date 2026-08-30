from pydantic import BaseModel, ConfigDict

from app.schemas.account import AccountOut


class BookingAgentBase(BaseModel):
    name: str
    contact_info: str | None = None
    linked_account_id: int | None = None
    default_commission_percent: float = 0


class BookingAgentCreate(BookingAgentBase):
    pass


class BookingAgentUpdate(BaseModel):
    name: str | None = None
    contact_info: str | None = None
    linked_account_id: int | None = None
    default_commission_percent: float | None = None


class BookingAgentOut(BookingAgentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    agent_code: str
    linked_account: AccountOut | None = None


class BookingCommissionRow(BaseModel):
    booking_id: int
    booking_ref_no: str
    unit_number: str
    allottee_name: str
    total_price: float
    received_amount: float
    received_percent: float
    commission_percent: float
    is_eligible: bool
    commission_eligible_amount: float
    commission_paid: float
    commission_balance: float


class BookingAgentSummary(BaseModel):
    agent: BookingAgentOut
    bookings: list[BookingCommissionRow]
    total_eligible: float
    total_paid: float
    total_balance: float
