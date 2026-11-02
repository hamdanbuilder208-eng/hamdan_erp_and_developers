from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.booking import BookingStatus, ExtraChargesReason, PaymentMode, ScheduleFrequency
from app.schemas.allottee import AllotteeOut
from app.schemas.booking_agent import BookingAgentOut
from app.schemas.project import ProjectOut
from app.schemas.unit import UnitOut


class PaymentScheduleLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    installment_plan_id: int | None
    installment_no: int
    label: str
    due_date: date
    mode_of_payment: PaymentMode
    amount: float
    discount: float
    paid_amount: float


class PaymentScheduleLineUpdate(BaseModel):
    due_date: date | None = None
    mode_of_payment: PaymentMode | None = None
    amount: float | None = None
    discount: float | None = None


class InstallmentPlanCreate(BaseModel):
    label: str = "Installments"
    frequency: ScheduleFrequency = ScheduleFrequency.MONTHLY
    no_of_installments: int
    total_amount: float
    start_date: date

    @model_validator(mode="after")
    def validate_plan(self):
        if self.no_of_installments <= 0:
            raise ValueError("Number of installments must be at least 1")
        if self.total_amount <= 0:
            raise ValueError("Installment plan amount must be greater than zero")
        return self


class InstallmentPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    label: str
    frequency: ScheduleFrequency
    no_of_installments: int
    total_amount: float
    start_date: date


class ExtraChargeCreate(BaseModel):
    reason: ExtraChargesReason
    # Required name when reason is Other; ignored otherwise.
    custom_reason: str | None = None
    amount: float
    charge_date: date
    narration: str | None = None

    @model_validator(mode="after")
    def validate_amount(self):
        if self.amount <= 0:
            raise ValueError("Extra charge amount must be greater than zero")
        if self.reason == ExtraChargesReason.OTHER:
            self.custom_reason = (self.custom_reason or "").strip()
            if not self.custom_reason:
                raise ValueError("For an 'Other' extra charge, type what the charge is for")
        else:
            self.custom_reason = None
        return self


class ExtraChargeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    schedule_line_id: int
    reason: ExtraChargesReason
    custom_reason: str | None = None
    # The reason, or the typed name for Other — what to show.
    reason_label: str
    amount: float
    charge_date: date
    narration: str | None


class BookingBase(BaseModel):
    booking_date: date
    project_id: int
    unit_id: int
    allottee_id: int
    status_date: date
    discount: float = 0
    remarks: str | None = None
    booking_agent_id: int | None = None
    agent_commission_percent: float | None = None
    # Fixed PKR commission; when set it's used instead of the percent.
    agent_commission_amount: float | None = None
    down_payment_amount: float = 0


class BookingCreate(BookingBase):
    installment_plans: list[InstallmentPlanCreate] = []
    extra_charges: list[ExtraChargeCreate] = []
    # Customer pays the whole price upfront (cash) — no installment plans.
    one_shot: bool = False
    # Due date of the down payment line; defaults to booking_date.
    down_payment_date: date | None = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    status_date: date


class BookingAgentAssign(BaseModel):
    booking_agent_id: int | None = None
    agent_commission_percent: float | None = None
    agent_commission_amount: float | None = None


class BookingOut(BookingBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    booking_ref_no: str
    status: BookingStatus
    total_price: float
    project: ProjectOut
    unit: UnitOut
    allottee: AllotteeOut
    booking_agent: BookingAgentOut | None = None
    installment_plans: list[InstallmentPlanOut]
    extra_charges: list[ExtraChargeOut]
    schedule_lines: list[PaymentScheduleLineOut]


class BookingTransferCreate(BaseModel):
    to_allottee_id: int
    transfer_date: date
    narration: str | None = None


class BookingTransferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    transfer_no: str
    transfer_date: date
    booking_id: int
    narration: str | None
    from_allottee: AllotteeOut
    to_allottee: AllotteeOut
