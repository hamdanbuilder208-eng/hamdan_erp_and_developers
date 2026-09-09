import io
import re

import openpyxl
from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.schemas.lead import LeadCreate, LeadImportResult

_NAME_HEADERS = {"name", "customer name", "full name", "customer"}
_MOBILE_HEADERS = {"mobile", "phone", "phone number", "mobile number", "contact", "contact number", "cell"}
_SOURCE_HEADERS = {"source", "lead source", "channel"}
_NOTES_HEADERS = {"notes", "note", "remarks", "comment", "comments"}


def _normalize_mobile(raw: str) -> str:
    # Excel often stores numbers as floats (e.g. 923001234567.0) or with
    # spaces/dashes copied straight from a phone's contact list — strip all of
    # that down to digits (keeping a leading +) so duplicates can be detected
    # reliably regardless of how the sheet formatted the column.
    raw = raw.strip()
    if raw.endswith(".0"):
        raw = raw[:-2]
    return re.sub(r"[^\d+]", "", raw)


def list_leads(db: Session) -> list[Lead]:
    return db.query(Lead).order_by(Lead.id.desc()).all()


def get_lead(db: Session, lead_id: int) -> Lead | None:
    return db.query(Lead).filter(Lead.id == lead_id).first()


def create_lead(db: Session, lead_in: LeadCreate) -> Lead:
    db_lead = Lead(
        name=lead_in.name,
        mobile=_normalize_mobile(lead_in.mobile),
        source=lead_in.source,
        notes=lead_in.notes,
    )
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    return db_lead


def delete_lead(db: Session, db_lead: Lead) -> None:
    db.delete(db_lead)
    db.commit()


def _find_column(header_row: list[str], candidates: set[str]) -> int | None:
    for idx, header in enumerate(header_row):
        if header and header.strip().lower() in candidates:
            return idx
    return None


def import_leads_from_excel(db: Session, file_bytes: bytes) -> LeadImportResult:
    """Reads the first sheet of an uploaded .xlsx workbook. Expects a header
    row with a name column and a phone/mobile column (source/notes optional,
    matched by common header spellings) — column order doesn't matter."""
    workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    workbook.close()

    if not rows:
        return LeadImportResult(imported=0, skipped_duplicates=0, skipped_invalid=0, total_rows=0)

    header_row = [str(c) if c is not None else "" for c in rows[0]]
    name_col = _find_column(header_row, _NAME_HEADERS)
    mobile_col = _find_column(header_row, _MOBILE_HEADERS)
    source_col = _find_column(header_row, _SOURCE_HEADERS)
    notes_col = _find_column(header_row, _NOTES_HEADERS)

    if mobile_col is None:
        raise ValueError(
            "Couldn't find a phone/mobile column in this sheet. Expected a header "
            "like 'Mobile', 'Phone' or 'Contact Number' in the first row."
        )

    existing_numbers = {m for (m,) in db.query(Lead.mobile).all()}

    data_rows = rows[1:]
    imported = 0
    skipped_duplicates = 0
    skipped_invalid = 0
    new_leads: list[Lead] = []

    for row in data_rows:
        raw_mobile = row[mobile_col] if mobile_col < len(row) else None
        if raw_mobile is None or str(raw_mobile).strip() == "":
            skipped_invalid += 1
            continue

        mobile = _normalize_mobile(str(raw_mobile))
        if not mobile:
            skipped_invalid += 1
            continue
        if mobile in existing_numbers:
            skipped_duplicates += 1
            continue

        name = (
            str(row[name_col]).strip()
            if name_col is not None and name_col < len(row) and row[name_col]
            else mobile
        )
        source = (
            str(row[source_col]).strip()
            if source_col is not None and source_col < len(row) and row[source_col]
            else None
        )
        notes = (
            str(row[notes_col]).strip()
            if notes_col is not None and notes_col < len(row) and row[notes_col]
            else None
        )

        new_leads.append(Lead(name=name, mobile=mobile, source=source, notes=notes))
        existing_numbers.add(mobile)
        imported += 1

    db.add_all(new_leads)
    db.commit()

    return LeadImportResult(
        imported=imported,
        skipped_duplicates=skipped_duplicates,
        skipped_invalid=skipped_invalid,
        total_rows=len(data_rows),
    )
