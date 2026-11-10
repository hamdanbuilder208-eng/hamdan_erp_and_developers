from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict

LeadFollowUpStatus = Literal["New", "Called", "No Answer", "Interested", "Not Interested", "Booked"]


class LeadBase(BaseModel):
    name: str
    mobile: str
    source: str | None = None
    notes: str | None = None


class LeadCreate(LeadBase):
    pass


class LeadFollowUpUpdate(BaseModel):
    status: LeadFollowUpStatus
    # Sent only when the notes should change too (e.g. what the lead said).
    notes: str | None = None


class LeadOut(LeadBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    follow_up_status: LeadFollowUpStatus = "New"
    follow_up_date: date | None = None


class LeadImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    skipped_invalid: int
    total_rows: int
