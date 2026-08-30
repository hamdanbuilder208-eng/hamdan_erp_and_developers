from sqlalchemy.orm import Session

from app.models.company_settings import CompanySettings
from app.schemas.company_settings import CompanySettingsUpdate

SETTINGS_ID = 1


def get_settings(db: Session) -> CompanySettings:
    settings_row = db.query(CompanySettings).filter(CompanySettings.id == SETTINGS_ID).first()
    if not settings_row:
        settings_row = CompanySettings(id=SETTINGS_ID)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


def update_settings(db: Session, settings_in: CompanySettingsUpdate) -> CompanySettings:
    settings_row = get_settings(db)
    for field, value in settings_in.model_dump(exclude_unset=True).items():
        setattr(settings_row, field, value)
    db.commit()
    db.refresh(settings_row)
    return settings_row
