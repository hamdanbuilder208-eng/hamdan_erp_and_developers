from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.inventory import MaterialIssueReason, PurchaseOrderStatus
from app.schemas.account import AccountOut
from app.schemas.project import ProjectOut


# Vendor


class VendorBase(BaseModel):
    name: str
    contact_person: str | None = None
    mobile: str | None = None
    phone: str | None = None
    address: str | None = None
    ntn_cnic: str | None = None
    is_active: bool = True


class VendorCreate(VendorBase):
    pass


class VendorUpdate(BaseModel):
    name: str | None = None
    contact_person: str | None = None
    mobile: str | None = None
    phone: str | None = None
    address: str | None = None
    ntn_cnic: str | None = None
    is_active: bool | None = None


class VendorOut(VendorBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    vendor_code: str


# Material


class MaterialBase(BaseModel):
    name: str
    unit_of_measure: str
    category: str | None = None
    is_active: bool = True


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    name: str | None = None
    unit_of_measure: str | None = None
    category: str | None = None
    is_active: bool | None = None


class MaterialOut(MaterialBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    material_code: str


# Purchase Order


class PurchaseOrderLineBase(BaseModel):
    material_id: int
    quantity: float = Field(gt=0)
    rate: float = Field(ge=0)


class PurchaseOrderLineCreate(PurchaseOrderLineBase):
    pass


class PurchaseOrderLineOut(PurchaseOrderLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: float
    material: MaterialOut


class PurchaseOrderBase(BaseModel):
    po_date: date
    vendor_id: int
    project_id: int | None = None
    status: PurchaseOrderStatus = PurchaseOrderStatus.DRAFT
    narration: str | None = None


class PurchaseOrderCreate(PurchaseOrderBase):
    lines: list[PurchaseOrderLineCreate]

    @model_validator(mode="after")
    def validate_lines(self):
        if not self.lines:
            raise ValueError("A purchase order needs at least one line item")
        return self


class PurchaseOrderUpdate(BaseModel):
    status: PurchaseOrderStatus | None = None
    narration: str | None = None


class PurchaseOrderOut(PurchaseOrderBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    po_no: str
    vendor: VendorOut
    project: ProjectOut | None = None
    lines: list[PurchaseOrderLineOut]


# GRN


class GRNLineBase(BaseModel):
    material_id: int
    quantity: float = Field(gt=0)
    rate: float = Field(ge=0)


class GRNLineCreate(GRNLineBase):
    pass


class GRNLineOut(GRNLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    amount: float
    material: MaterialOut


class GRNBase(BaseModel):
    grn_date: date
    vendor_id: int
    project_id: int | None = None
    po_id: int | None = None
    payment_account_id: int
    narration: str | None = None


class GRNCreate(GRNBase):
    lines: list[GRNLineCreate]

    @model_validator(mode="after")
    def validate_lines(self):
        if not self.lines:
            raise ValueError("A GRN needs at least one line item")
        return self


class GRNOut(GRNBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    grn_no: str
    total_amount: float
    voucher_id: int | None
    vendor: VendorOut
    project: ProjectOut | None = None
    payment_account: AccountOut
    lines: list[GRNLineOut]


# Material Issue


class MaterialIssueLineBase(BaseModel):
    material_id: int
    quantity: float = Field(gt=0)


class MaterialIssueLineCreate(MaterialIssueLineBase):
    pass


class MaterialIssueLineOut(MaterialIssueLineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    rate: float
    amount: float
    material: MaterialOut


class MaterialIssueBase(BaseModel):
    issue_date: date
    project_id: int
    reason: MaterialIssueReason = MaterialIssueReason.SITE_CONSUMPTION
    issued_to: str | None = None
    narration: str | None = None


class MaterialIssueCreate(MaterialIssueBase):
    lines: list[MaterialIssueLineCreate]

    @model_validator(mode="after")
    def validate_lines(self):
        if not self.lines:
            raise ValueError("A material issue needs at least one line item")
        return self


class MaterialIssueOut(MaterialIssueBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_no: str
    voucher_id: int | None
    resolved: bool
    resolved_date: date | None
    resolution_note: str | None
    restocked: bool
    project: ProjectOut
    lines: list[MaterialIssueLineOut]


class MaterialIssueResolve(BaseModel):
    resolution_note: str | None = None
    restock: bool = False


# Stock balance (read-only summary)


class StockBalanceOut(BaseModel):
    material_id: int
    material_code: str
    material_name: str
    unit_of_measure: str
    project_id: int | None
    project_name: str | None
    balance_qty: float
    balance_value: float
