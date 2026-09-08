from datetime import date

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.inventory import MaterialIssueReason, MaterialIssueStatus, PurchaseOrderStatus
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


# Warehouse


class WarehouseBase(BaseModel):
    name: str
    location: str | None = None
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    is_active: bool | None = None


class WarehouseOut(WarehouseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    warehouse_code: str


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
    # Received into a warehouse (goes into store stock) or, when the vendor
    # delivers straight to site, a project instead (goes into that project's
    # site stock directly, skipping the warehouse). Exactly one of the two
    # is the actual destination — enforced in GRNCreate below.
    warehouse_id: int | None = None
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
        if not self.warehouse_id and not self.project_id:
            raise ValueError("Choose a warehouse or a project to receive this material into")
        return self


class GRNOut(GRNBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    grn_no: str
    total_amount: float
    voucher_id: int | None
    vendor: VendorOut
    warehouse: WarehouseOut | None = None
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
    # Nullable for output only — issues created before the warehouses feature
    # have no warehouse on file. New issues must pick one (enforced below).
    warehouse_id: int | None = None
    reason: MaterialIssueReason = MaterialIssueReason.SITE_CONSUMPTION
    issued_to: str | None = None
    narration: str | None = None


class MaterialIssueCreate(MaterialIssueBase):
    warehouse_id: int
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
    status: MaterialIssueStatus
    received_date: date | None
    received_by: str | None
    project: ProjectOut
    warehouse: WarehouseOut | None = None
    lines: list[MaterialIssueLineOut]


class MaterialIssueResolve(BaseModel):
    resolution_note: str | None = None
    restock: bool = False


class MaterialIssueReceive(BaseModel):
    received_by: str


# Opening Stock


class OpeningStockBase(BaseModel):
    opening_date: date
    material_id: int
    quantity: float = Field(gt=0)
    rate: float = Field(ge=0)
    warehouse_id: int | None = None
    project_id: int | None = None
    narration: str | None = None


class OpeningStockCreate(OpeningStockBase):
    @model_validator(mode="after")
    def validate_location(self):
        if not self.warehouse_id and not self.project_id:
            raise ValueError("Choose a warehouse or project to receive this opening stock into")
        return self


class OpeningStockOut(OpeningStockBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    opening_no: str
    amount: float
    voucher_id: int | None
    material: MaterialOut
    warehouse: WarehouseOut | None = None
    project: ProjectOut | None = None


# Material Transfer


class MaterialTransferBase(BaseModel):
    transfer_date: date
    material_id: int
    quantity: float = Field(gt=0)
    from_warehouse_id: int | None = None
    from_project_id: int | None = None
    to_warehouse_id: int | None = None
    to_project_id: int | None = None
    narration: str | None = None


class MaterialTransferCreate(MaterialTransferBase):
    @model_validator(mode="after")
    def validate_locations(self):
        if not self.from_warehouse_id and not self.from_project_id:
            raise ValueError("Choose a warehouse or project to transfer from")
        if not self.to_warehouse_id and not self.to_project_id:
            raise ValueError("Choose a warehouse or project to transfer to")
        from_key = ("w", self.from_warehouse_id) if self.from_warehouse_id else ("p", self.from_project_id)
        to_key = ("w", self.to_warehouse_id) if self.to_warehouse_id else ("p", self.to_project_id)
        if from_key == to_key:
            raise ValueError("Source and destination must be different")
        return self


class MaterialTransferOut(MaterialTransferBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    transfer_no: str
    rate: float
    amount: float
    material: MaterialOut
    from_warehouse: WarehouseOut | None = None
    from_project: ProjectOut | None = None
    to_warehouse: WarehouseOut | None = None
    to_project: ProjectOut | None = None


# Stock balance (read-only summary)


class StockBalanceOut(BaseModel):
    material_id: int
    material_code: str
    material_name: str
    unit_of_measure: str
    warehouse_id: int | None
    warehouse_name: str | None
    balance_qty: float
    balance_value: float


class ProjectStockOut(BaseModel):
    material_id: int
    material_code: str
    material_name: str
    unit_of_measure: str
    project_id: int | None
    project_name: str | None
    balance_qty: float
    balance_value: float
