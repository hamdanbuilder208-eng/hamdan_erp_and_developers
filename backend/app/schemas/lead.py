from pydantic import BaseModel, ConfigDict


class LeadBase(BaseModel):
    name: str
    mobile: str
    source: str | None = None
    notes: str | None = None


class LeadCreate(LeadBase):
    pass


class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class LeadImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    skipped_invalid: int
    total_rows: int
