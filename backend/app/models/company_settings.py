from sqlalchemy import String

from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base, TimestampMixin


class CompanySettings(Base, TimestampMixin):
    """Singleton row (always id=1) holding company-wide print/branding settings."""

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(primary_key=True)

    company_name: Mapped[str] = mapped_column(String(150), default="Hamdan Builders and Developers")
    accountant_name: Mapped[str | None] = mapped_column(String(150))
    accountant_designation: Mapped[str | None] = mapped_column(String(100))
    signature_image_url: Mapped[str | None] = mapped_column(String(255))
