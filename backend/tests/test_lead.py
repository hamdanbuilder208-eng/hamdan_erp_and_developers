import io

import openpyxl
import pytest
from sqlalchemy.orm import Session

from app.crud import lead as lead_crud
from app.models.lead import Lead
from app.schemas.lead import LeadCreate


def _make_xlsx(header: list[str], rows: list[list]) -> bytes:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(header)
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_create_lead_normalizes_mobile_number(db: Session):
    lead = lead_crud.create_lead(
        db, LeadCreate(name="Ahmed", mobile="0300-123 4567")
    )
    assert lead.mobile == "03001234567"


def test_delete_lead_removes_it(db: Session):
    lead = lead_crud.create_lead(db, LeadCreate(name="Ahmed", mobile="03001234567"))

    lead_crud.delete_lead(db, lead)

    assert lead_crud.get_lead(db, lead.id) is None


def test_list_leads_orders_newest_first(db: Session):
    first = lead_crud.create_lead(db, LeadCreate(name="First", mobile="03001111111"))
    second = lead_crud.create_lead(db, LeadCreate(name="Second", mobile="03002222222"))

    result = lead_crud.list_leads(db)

    assert [l.id for l in result] == [second.id, first.id]


def test_import_reads_name_and_mobile_columns(db: Session):
    file_bytes = _make_xlsx(
        ["Name", "Mobile", "Source"],
        [
            ["Ahmed Raza", "03001234567", "Facebook"],
            ["Fatima Sheikh", "03219876543", "Referral"],
        ],
    )

    result = lead_crud.import_leads_from_excel(db, file_bytes)

    assert result.imported == 2
    assert result.total_rows == 2
    leads = lead_crud.list_leads(db)
    assert {l.name for l in leads} == {"Ahmed Raza", "Fatima Sheikh"}
    assert {l.source for l in leads} == {"Facebook", "Referral"}


def test_import_accepts_alternate_header_spellings(db: Session):
    """Column matching is case-insensitive and accepts common synonyms like
    'Phone' or 'Contact Number' instead of the exact word 'Mobile'."""
    file_bytes = _make_xlsx(
        ["Customer Name", "Phone Number"],
        [["Bilal Malik", "03211234567"]],
    )

    result = lead_crud.import_leads_from_excel(db, file_bytes)

    assert result.imported == 1
    assert lead_crud.list_leads(db)[0].name == "Bilal Malik"


def test_import_skips_rows_already_in_the_database(db: Session):
    lead_crud.create_lead(db, LeadCreate(name="Existing", mobile="03001234567"))
    file_bytes = _make_xlsx(
        ["Name", "Mobile"],
        [["Ahmed Raza", "03001234567"], ["New Lead", "03219876543"]],
    )

    result = lead_crud.import_leads_from_excel(db, file_bytes)

    assert result.imported == 1
    assert result.skipped_duplicates == 1
    assert lead_crud.list_leads(db)[0].name == "New Lead"


def test_import_skips_duplicates_within_the_same_file(db: Session):
    file_bytes = _make_xlsx(
        ["Name", "Mobile"],
        [["First", "03001234567"], ["Same Number Again", "03001234567"]],
    )

    result = lead_crud.import_leads_from_excel(db, file_bytes)

    assert result.imported == 1
    assert result.skipped_duplicates == 1


def test_import_skips_rows_with_no_phone_number(db: Session):
    file_bytes = _make_xlsx(
        ["Name", "Mobile"],
        [["No Phone Guy", ""], ["Has Phone", "03001234567"]],
    )

    result = lead_crud.import_leads_from_excel(db, file_bytes)

    assert result.imported == 1
    assert result.skipped_invalid == 1
    assert result.total_rows == 2


def test_import_falls_back_to_mobile_when_name_is_blank(db: Session):
    file_bytes = _make_xlsx(
        ["Name", "Mobile"],
        [["", "03001234567"]],
    )

    lead_crud.import_leads_from_excel(db, file_bytes)

    assert lead_crud.list_leads(db)[0].name == "03001234567"


def test_import_normalizes_excel_float_formatted_numbers(db: Session):
    """Excel frequently stores a numeric-looking phone column as a float
    (e.g. 923001234567.0) rather than text — this must still normalize to a
    clean digit string, not literally include the trailing '.0'."""
    file_bytes = _make_xlsx(
        ["Name", "Mobile"],
        [["Ahmed Raza", "923001234567.0"]],
    )

    lead_crud.import_leads_from_excel(db, file_bytes)

    assert lead_crud.list_leads(db)[0].mobile == "923001234567"


def test_import_raises_when_no_mobile_column_found(db: Session):
    file_bytes = _make_xlsx(["Name", "Email"], [["Ahmed Raza", "a@example.com"]])

    with pytest.raises(ValueError, match="phone/mobile column"):
        lead_crud.import_leads_from_excel(db, file_bytes)


def test_import_empty_sheet_returns_zero_counts(db: Session):
    workbook = openpyxl.Workbook()
    buffer = io.BytesIO()
    workbook.save(buffer)

    result = lead_crud.import_leads_from_excel(db, buffer.getvalue())

    assert result.imported == 0
    assert result.total_rows == 0
