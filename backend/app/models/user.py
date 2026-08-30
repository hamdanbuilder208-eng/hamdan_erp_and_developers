from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    users: Mapped[list["User"]] = relationship(back_populates="role")
    module_permissions: Mapped[list["RoleModulePermission"]] = relationship(
        back_populates="role", cascade="all, delete-orphan"
    )

    @property
    def allowed_modules(self) -> list[str]:
        """Lets RoleOut (from_attributes=True) read a plain list[str] straight off
        the ORM object instead of the relationship's list[RoleModulePermission]."""
        return [p.module_key for p in self.module_permissions]


class RoleModulePermission(Base, TimestampMixin):
    """One row per module a role is granted (see core/modules.py for the fixed
    key list). Irrelevant when the role's is_admin=True — that bypasses this
    check entirely (see api/deps.py:require_module_access)."""

    __tablename__ = "role_module_permissions"
    __table_args__ = (UniqueConstraint("role_id", "module_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    module_key: Mapped[str] = mapped_column(String(50), nullable=False)

    role: Mapped["Role"] = relationship(back_populates="module_permissions")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(120), unique=True)
    full_name: Mapped[str | None] = mapped_column(String(150))
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    role: Mapped["Role"] = relationship(back_populates="users")
