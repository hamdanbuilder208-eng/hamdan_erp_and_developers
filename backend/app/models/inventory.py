import enum
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class Vendor(Base, TimestampMixin):
    __tablename__ = "vendors"

    id: Mapped[int] = mapped_column(primary_key=True)
    vendor_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(150))
    mobile: Mapped[str | None] = mapped_column(String(30))
    phone: Mapped[str | None] = mapped_column(String(30))
    address: Mapped[str | None] = mapped_column(Text)
    ntn_cnic: Mapped[str | None] = mapped_column(String(30))
    is_active: Mapped[bool] = mapped_column(default=True)


class Material(Base, TimestampMixin):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    material_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    unit_of_measure: Mapped[str] = mapped_column(String(30), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(default=True)


class Warehouse(Base, TimestampMixin):
    """A physical stock location — material lands here via GRN and is later
    issued out to a project/site. Stock balances are tracked per (material,
    warehouse), not per project, since the same warehouse can supply many
    projects over time. A GRN can skip the warehouse entirely when the vendor
    delivers straight to a project/site — see GRN.warehouse_id."""

    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True)
    warehouse_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    location: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True)


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "Draft"
    APPROVED = "Approved"
    CLOSED = "Closed"
    CANCELLED = "Cancelled"


class PurchaseOrder(Base, TimestampMixin):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    po_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    po_date: Mapped[date] = mapped_column(Date, nullable=False)

    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT
    )
    narration: Mapped[str | None] = mapped_column(Text)

    vendor: Mapped["Vendor"] = relationship()
    project: Mapped["Project | None"] = relationship()
    lines: Mapped[list["PurchaseOrderLine"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )


class PurchaseOrderLine(Base, TimestampMixin):
    __tablename__ = "purchase_order_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)

    quantity: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="lines")
    material: Mapped["Material"] = relationship()


class GRN(Base, TimestampMixin):
    __tablename__ = "grns"

    id: Mapped[int] = mapped_column(primary_key=True)
    grn_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    grn_date: Mapped[date] = mapped_column(Date, nullable=False)

    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id"), nullable=False)
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    po_id: Mapped[int | None] = mapped_column(ForeignKey("purchase_orders.id"))
    payment_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), nullable=False)
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    total_amount: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    narration: Mapped[str | None] = mapped_column(Text)

    vendor: Mapped["Vendor"] = relationship()
    warehouse: Mapped["Warehouse | None"] = relationship()
    project: Mapped["Project | None"] = relationship()
    purchase_order: Mapped["PurchaseOrder | None"] = relationship()
    payment_account: Mapped["Account"] = relationship()
    lines: Mapped[list["GRNLine"]] = relationship(back_populates="grn", cascade="all, delete-orphan")


class GRNLine(Base, TimestampMixin):
    __tablename__ = "grn_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    grn_id: Mapped[int] = mapped_column(ForeignKey("grns.id"), nullable=False)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)

    quantity: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    grn: Mapped["GRN"] = relationship(back_populates="lines")
    material: Mapped["Material"] = relationship()


class MaterialIssueReason(str, enum.Enum):
    SITE_CONSUMPTION = "Site Consumption"
    DAMAGED = "Damaged / Wastage"


class MaterialIssueStatus(str, enum.Enum):
    DISPATCHED = "Dispatched"
    RECEIVED = "Received"


class MaterialIssue(Base, TimestampMixin):
    __tablename__ = "material_issues"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    reason: Mapped[MaterialIssueReason] = mapped_column(
        Enum(MaterialIssueReason), default=MaterialIssueReason.SITE_CONSUMPTION
    )
    issued_to: Mapped[str | None] = mapped_column(String(150))
    narration: Mapped[str | None] = mapped_column(Text)

    # Dispatch -> site-receipt tracking (confirmed via the QR code printed on the
    # issue slip, scanned by whoever receives the delivery at the site).
    status: Mapped[MaterialIssueStatus] = mapped_column(
        Enum(MaterialIssueStatus), default=MaterialIssueStatus.DISPATCHED
    )
    received_date: Mapped[date | None] = mapped_column(Date)
    received_by: Mapped[str | None] = mapped_column(String(150))

    # Only meaningful when reason=DAMAGED: whether the vendor has made good on a
    # reported damage/wastage (replacement, refund, credit note, etc).
    resolved: Mapped[bool] = mapped_column(default=False)
    resolved_date: Mapped[date | None] = mapped_column(Date)
    resolution_note: Mapped[str | None] = mapped_column(Text)
    restocked: Mapped[bool] = mapped_column(default=False)

    project: Mapped["Project"] = relationship()
    warehouse: Mapped["Warehouse | None"] = relationship()
    lines: Mapped[list["MaterialIssueLine"]] = relationship(
        back_populates="material_issue", cascade="all, delete-orphan"
    )


class MaterialIssueLine(Base, TimestampMixin):
    __tablename__ = "material_issue_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("material_issues.id"), nullable=False)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)

    quantity: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    material_issue: Mapped["MaterialIssue"] = relationship(back_populates="lines")
    material: Mapped["Material"] = relationship()


class StockMovementType(str, enum.Enum):
    IN = "IN"
    OUT = "OUT"


class StockRefType(str, enum.Enum):
    GRN = "GRN"
    ISSUE = "Issue"
    RESTOCK = "Restock"
    TRANSFER = "Transfer"
    OPENING = "Opening"
    PETTY_CASH = "Petty Cash"


class StockLedger(Base, TimestampMixin):
    """Immutable per-movement audit trail. `balance_qty`/`balance_value` are the
    running balance as of this row, computed at insert time from the previous
    row for the same pair — a simple perpetual moving-average inventory
    valuation. The balance is keyed by `warehouse_id` whenever one is set
    (`project_id` is then just a reporting tag — which project a warehouse
    receipt/issue was for). Only when `warehouse_id` is null — material
    received or held directly at a project/site, no warehouse stop — does
    `project_id` become part of the key instead, giving each project its own
    balance pool."""

    __tablename__ = "stock_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))

    movement_date: Mapped[date] = mapped_column(Date, nullable=False)
    movement_type: Mapped[StockMovementType] = mapped_column(Enum(StockMovementType), nullable=False)
    ref_type: Mapped[StockRefType] = mapped_column(Enum(StockRefType), nullable=False)
    ref_id: Mapped[int] = mapped_column(nullable=False)

    quantity: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    balance_qty: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    balance_value: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    material: Mapped["Material"] = relationship()
    warehouse: Mapped["Warehouse | None"] = relationship()
    project: Mapped["Project | None"] = relationship()


class MaterialTransfer(Base, TimestampMixin):
    """Moves existing stock from one location to another — warehouse to
    warehouse, project to project, or between the two — at the source's
    current weighted-average rate. Unlike a GRN or Material Issue this never
    changes the company-wide inventory value or posts an accounting entry;
    it only relocates where a quantity already on hand is tracked."""

    __tablename__ = "material_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    transfer_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    transfer_date: Mapped[date] = mapped_column(Date, nullable=False)

    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    from_warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    from_project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    to_warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    to_project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))

    narration: Mapped[str | None] = mapped_column(Text)

    material: Mapped["Material"] = relationship()
    from_warehouse: Mapped["Warehouse | None"] = relationship(foreign_keys=[from_warehouse_id])
    from_project: Mapped["Project | None"] = relationship(foreign_keys=[from_project_id])
    to_warehouse: Mapped["Warehouse | None"] = relationship(foreign_keys=[to_warehouse_id])
    to_project: Mapped["Project | None"] = relationship(foreign_keys=[to_project_id])


class OpeningStock(Base, TimestampMixin):
    """Seeds a warehouse (or project) with material that's already physically
    on hand when it's set up in the system — no vendor, no purchase. Posts a
    stock-in movement plus a journal entry (debit Material Stock, credit
    Owner's Capital) so the balance sheet stays correct."""

    __tablename__ = "opening_stocks"

    id: Mapped[int] = mapped_column(primary_key=True)
    opening_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    opening_date: Mapped[date] = mapped_column(Date, nullable=False)

    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(18, 2), nullable=False)

    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"))
    voucher_id: Mapped[int | None] = mapped_column(ForeignKey("vouchers.id"))

    narration: Mapped[str | None] = mapped_column(Text)

    material: Mapped["Material"] = relationship()
    warehouse: Mapped["Warehouse | None"] = relationship()
    project: Mapped["Project | None"] = relationship()
