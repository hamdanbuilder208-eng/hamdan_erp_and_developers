from pydantic import BaseModel, ConfigDict


class CompanySettingsUpdate(BaseModel):
    company_name: str | None = None
    accountant_name: str | None = None
    accountant_designation: str | None = None
    signature_image_url: str | None = None


class CompanySettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_name: str
    accountant_name: str | None
    accountant_designation: str | None
    signature_image_url: str | None
