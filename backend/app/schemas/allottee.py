import re

from pydantic import BaseModel, ConfigDict, field_validator

_CNIC_RE = re.compile(r"^[0-9-]+$")
_PHONE_RE = re.compile(r"^[0-9+\-() ]+$")


def cnic_digits(value: str | None) -> str:
    """CNIC with dashes stripped, so '42101-1234567-1' and '4210112345671' compare equal."""
    return (value or "").replace("-", "")


def _clean_cnic(value: str | None, label: str) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if not _CNIC_RE.match(value):
        raise ValueError(f"{label} can only contain digits and dashes")
    if len(cnic_digits(value)) != 13:
        raise ValueError(f"{label} must have 13 digits (e.g. 42101-1234567-1)")
    return value


def _clean_phone(value: str | None, label: str) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if not _PHONE_RE.match(value):
        raise ValueError(f"{label} can only contain numbers")
    return value


class _AllotteeValidators(BaseModel):
    @field_validator("cnic", check_fields=False)
    @classmethod
    def _v_cnic(cls, v: str | None) -> str | None:
        return _clean_cnic(v, "CNIC")

    @field_validator("nominee_cnic", check_fields=False)
    @classmethod
    def _v_nominee_cnic(cls, v: str | None) -> str | None:
        return _clean_cnic(v, "Nominee CNIC")

    @field_validator("mobile", "tel_res", "office_phone", "fax", check_fields=False)
    @classmethod
    def _v_phone(cls, v: str | None, info) -> str | None:
        labels = {"mobile": "Mobile No.", "tel_res": "Tel (Res.)", "office_phone": "Office", "fax": "Fax"}
        return _clean_phone(v, labels[info.field_name])


class AllotteeBase(_AllotteeValidators):
    name: str
    father_name: str | None = None
    current_address: str | None = None
    cnic_address: str | None = None
    mobile: str | None = None
    tel_res: str | None = None
    office_phone: str | None = None
    fax: str | None = None
    cnic: str | None = None
    email: str | None = None
    referred_by: str | None = None
    picture_url: str | None = None
    nominee_name: str | None = None
    nominee_relation: str | None = None
    nominee_cnic: str | None = None
    nominee_current_address: str | None = None
    nominee_cnic_address: str | None = None
    nominee_picture_url: str | None = None


class AllotteeCreate(AllotteeBase):
    pass


class AllotteeUpdate(_AllotteeValidators):
    name: str | None = None
    father_name: str | None = None
    current_address: str | None = None
    cnic_address: str | None = None
    mobile: str | None = None
    tel_res: str | None = None
    office_phone: str | None = None
    fax: str | None = None
    cnic: str | None = None
    email: str | None = None
    referred_by: str | None = None
    picture_url: str | None = None
    nominee_name: str | None = None
    nominee_relation: str | None = None
    nominee_cnic: str | None = None
    nominee_current_address: str | None = None
    nominee_cnic_address: str | None = None
    nominee_picture_url: str | None = None


class AllotteeOut(BaseModel):
    """Output is not re-validated — records saved before these rules existed
    must still load."""

    model_config = ConfigDict(from_attributes=True)
    id: int
    allottee_code: str
    name: str
    father_name: str | None = None
    current_address: str | None = None
    cnic_address: str | None = None
    mobile: str | None = None
    tel_res: str | None = None
    office_phone: str | None = None
    fax: str | None = None
    cnic: str | None = None
    email: str | None = None
    referred_by: str | None = None
    picture_url: str | None = None
    nominee_name: str | None = None
    nominee_relation: str | None = None
    nominee_cnic: str | None = None
    nominee_current_address: str | None = None
    nominee_cnic_address: str | None = None
    nominee_picture_url: str | None = None
