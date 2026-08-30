from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class CustomerAccount(Base, TimestampMixin):
    __tablename__ = "customer_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    allottee_id: Mapped[int] = mapped_column(ForeignKey("allottees.id"), unique=True, nullable=False)

    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    allottee: Mapped["Allottee"] = relationship()
