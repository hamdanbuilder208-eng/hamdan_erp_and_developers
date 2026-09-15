from pydantic import BaseModel, ConfigDict, model_validator

from app.models.booking import ScheduleFrequency
from app.models.project import ProjectStatus


class ProjectGroupBase(BaseModel):
    name: str


class ProjectGroupCreate(ProjectGroupBase):
    pass


class ProjectGroupOut(ProjectGroupBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class ProjectFloorBase(BaseModel):
    block: str | None = None
    floor_no: str
    no_of_units: int = 0


class ProjectFloorCreate(ProjectFloorBase):
    pass


class ProjectFloorOut(ProjectFloorBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


class ProjectBase(BaseModel):
    project_name: str
    address: str | None = None
    total_budget: float | None = None
    commission_percent: float | None = 0
    total_floors: int | None = 0
    status: ProjectStatus = ProjectStatus.ACTIVE
    project_group_id: int | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_name: str | None = None
    address: str | None = None
    total_budget: float | None = None
    commission_percent: float | None = None
    total_floors: int | None = None
    status: ProjectStatus | None = None
    project_group_id: int | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_code: str
    project_group: ProjectGroupOut | None = None


class ProjectDetailOut(ProjectOut):
    floors: list[ProjectFloorOut] = []
    total_spent: float = 0


class PaymentTemplateLineCreate(BaseModel):
    label: str = "Installments"
    frequency: ScheduleFrequency = ScheduleFrequency.MONTHLY
    no_of_installments: int
    percent: float
    months_after_booking: int = 0

    @model_validator(mode="after")
    def validate_line(self):
        if self.no_of_installments <= 0:
            raise ValueError("Number of installments must be at least 1")
        if self.percent <= 0:
            raise ValueError("Percent must be greater than zero")
        if self.months_after_booking < 0:
            raise ValueError("Months after booking cannot be negative")
        return self


class PaymentTemplateLineOut(PaymentTemplateLineCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int


class PaymentTemplateUpsert(BaseModel):
    booking_percent: float = 0
    lines: list[PaymentTemplateLineCreate] = []

    @model_validator(mode="after")
    def validate_total(self):
        if self.booking_percent < 0:
            raise ValueError("Booking percent cannot be negative")
        total = self.booking_percent + sum(line.percent for line in self.lines)
        if round(total, 2) != 100:
            raise ValueError(f"Booking % plus all lines must add up to 100% (currently {total:.2f}%)")
        return self


class PaymentTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    booking_percent: float
    lines: list[PaymentTemplateLineOut]
