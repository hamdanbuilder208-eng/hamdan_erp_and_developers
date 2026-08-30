from pydantic import BaseModel, ConfigDict

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
    status: ProjectStatus = ProjectStatus.ACTIVE
    project_group_id: int | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_name: str | None = None
    address: str | None = None
    total_budget: float | None = None
    commission_percent: float | None = None
    status: ProjectStatus | None = None
    project_group_id: int | None = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_code: str
    project_group: ProjectGroupOut | None = None


class ProjectDetailOut(ProjectOut):
    floors: list[ProjectFloorOut] = []
