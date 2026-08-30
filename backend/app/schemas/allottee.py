from pydantic import BaseModel, ConfigDict


class AllotteeBase(BaseModel):
    name: str
    father_name: str | None = None
    address: str | None = None
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
    nominee_picture_url: str | None = None


class AllotteeCreate(AllotteeBase):
    pass


class AllotteeUpdate(BaseModel):
    name: str | None = None
    father_name: str | None = None
    address: str | None = None
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
    nominee_picture_url: str | None = None


class AllotteeOut(AllotteeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    allottee_code: str
