import enum

from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class ProjectStatus(str, enum.Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"


class ProjectGroup(Base, TimestampMixin):
    __tablename__ = "project_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    projects: Mapped[list["Project"]] = relationship(back_populates="project_group")


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    project_name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    total_budget: Mapped[float | None] = mapped_column(Numeric(18, 2))
    commission_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), default=0)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), default=ProjectStatus.ACTIVE
    )

    project_group_id: Mapped[int | None] = mapped_column(ForeignKey("project_groups.id"))
    project_group: Mapped["ProjectGroup | None"] = relationship(back_populates="projects")

    floors: Mapped[list["ProjectFloor"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    units: Mapped[list["Unit"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectFloor(Base, TimestampMixin):
    __tablename__ = "project_floors"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    block: Mapped[str | None] = mapped_column(String(50))
    floor_no: Mapped[str] = mapped_column(String(20), nullable=False)
    no_of_units: Mapped[int] = mapped_column(default=0)

    project: Mapped["Project"] = relationship(back_populates="floors")
    units: Mapped[list["Unit"]] = relationship(back_populates="floor")
