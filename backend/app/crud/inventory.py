from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.sequences import next_sequence_number
from app.models.account import Account, AccountNature
from app.models.inventory import (
    GRN,
    GRNLine,
    Material,
    MaterialIssue,
    MaterialIssueLine,
    MaterialIssueReason,
    MaterialIssueStatus,
    MaterialTransfer,
    OpeningStock,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderStatus,
    StockLedger,
    StockMovementType,
    StockRefType,
    Vendor,
    Warehouse,
)
from app.models.project import Project
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.inventory import (
    GRNCreate,
    MaterialCreate,
    MaterialIssueCreate,
    MaterialTransferCreate,
    MaterialUpdate,
    OpeningStockCreate,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    VendorCreate,
    VendorUpdate,
    WarehouseCreate,
    WarehouseUpdate,
)

MATERIAL_STOCK_ACCOUNT_CODE = "1040"
MATERIAL_CONSUMPTION_ACCOUNT_CODE = "5050"
MATERIAL_WASTAGE_ACCOUNT_CODE = "5060"
OWNER_CAPITAL_ACCOUNT_CODE = "3010"


def _get_or_create_wastage_account(db: Session) -> Account:
    account = db.query(Account).filter(Account.code == MATERIAL_WASTAGE_ACCOUNT_CODE).first()
    if account:
        return account
    expenses_group = db.query(Account).filter(Account.code == "5000").first()
    account = Account(
        code=MATERIAL_WASTAGE_ACCOUNT_CODE,
        name="Material Wastage / Damage",
        nature=AccountNature.EXPENSE,
        parent_id=expenses_group.id if expenses_group else None,
    )
    db.add(account)
    db.flush()
    return account


def _get_account_by_code(db: Session, code: str) -> Account:
    account = db.query(Account).filter(Account.code == code).first()
    if not account:
        raise ValueError(f"Required account (code {code}) not found in chart of accounts")
    return account


def _next_journal_voucher_no(db: Session) -> str:
    return next_sequence_number(db, Voucher.voucher_no, "JV-", 5)


# Vendor


def list_vendors(db: Session, is_active: bool | None = None) -> list[Vendor]:
    query = db.query(Vendor)
    if is_active is not None:
        query = query.filter(Vendor.is_active == is_active)
    return query.order_by(Vendor.id.desc()).all()


def get_vendor(db: Session, vendor_id: int) -> Vendor | None:
    return db.query(Vendor).filter(Vendor.id == vendor_id).first()


def create_vendor(db: Session, vendor_in: VendorCreate) -> Vendor:
    db_vendor = Vendor(
        vendor_code=next_sequence_number(db, Vendor.vendor_code, "VEN-", 5),
        **vendor_in.model_dump(),
    )
    db.add(db_vendor)
    db.commit()
    db.refresh(db_vendor)
    return db_vendor


def update_vendor(db: Session, db_vendor: Vendor, vendor_in: VendorUpdate) -> Vendor:
    for field, value in vendor_in.model_dump(exclude_unset=True).items():
        setattr(db_vendor, field, value)
    db.commit()
    db.refresh(db_vendor)
    return db_vendor


def delete_vendor(db: Session, db_vendor: Vendor) -> None:
    db.delete(db_vendor)
    db.commit()


# Warehouse


def list_warehouses(db: Session, is_active: bool | None = None) -> list[Warehouse]:
    query = db.query(Warehouse)
    if is_active is not None:
        query = query.filter(Warehouse.is_active == is_active)
    return query.order_by(Warehouse.id.desc()).all()


def get_warehouse(db: Session, warehouse_id: int) -> Warehouse | None:
    return db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()


def create_warehouse(db: Session, warehouse_in: WarehouseCreate) -> Warehouse:
    db_warehouse = Warehouse(
        warehouse_code=next_sequence_number(db, Warehouse.warehouse_code, "WH-", 4),
        **warehouse_in.model_dump(),
    )
    db.add(db_warehouse)
    db.commit()
    db.refresh(db_warehouse)
    return db_warehouse


def update_warehouse(db: Session, db_warehouse: Warehouse, warehouse_in: WarehouseUpdate) -> Warehouse:
    for field, value in warehouse_in.model_dump(exclude_unset=True).items():
        setattr(db_warehouse, field, value)
    db.commit()
    db.refresh(db_warehouse)
    return db_warehouse


def delete_warehouse(db: Session, db_warehouse: Warehouse) -> None:
    movement_count = (
        db.query(StockLedger).filter(StockLedger.warehouse_id == db_warehouse.id).count()
    )
    if movement_count:
        raise ValueError(
            f"{db_warehouse.name} has {movement_count} stock movement(s) recorded against it "
            "and cannot be deleted."
        )
    db.delete(db_warehouse)
    db.commit()


# Material


def list_materials(db: Session, is_active: bool | None = None) -> list[Material]:
    query = db.query(Material)
    if is_active is not None:
        query = query.filter(Material.is_active == is_active)
    return query.order_by(Material.id.desc()).all()


def get_material(db: Session, material_id: int) -> Material | None:
    return db.query(Material).filter(Material.id == material_id).first()


def create_material(db: Session, material_in: MaterialCreate) -> Material:
    db_material = Material(
        material_code=next_sequence_number(db, Material.material_code, "MAT-", 5),
        **material_in.model_dump(),
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


def update_material(db: Session, db_material: Material, material_in: MaterialUpdate) -> Material:
    for field, value in material_in.model_dump(exclude_unset=True).items():
        setattr(db_material, field, value)
    db.commit()
    db.refresh(db_material)
    return db_material


def delete_material(db: Session, db_material: Material) -> None:
    db.delete(db_material)
    db.commit()


# Purchase Order


def _load_po_query(db: Session):
    return db.query(PurchaseOrder).options(
        joinedload(PurchaseOrder.vendor),
        joinedload(PurchaseOrder.project),
        joinedload(PurchaseOrder.lines).joinedload(PurchaseOrderLine.material),
    )


def list_purchase_orders(
    db: Session, project_id: int | None = None, vendor_id: int | None = None
) -> list[PurchaseOrder]:
    query = _load_po_query(db)
    if project_id is not None:
        query = query.filter(PurchaseOrder.project_id == project_id)
    if vendor_id is not None:
        query = query.filter(PurchaseOrder.vendor_id == vendor_id)
    return query.order_by(PurchaseOrder.id.desc()).all()


def get_purchase_order(db: Session, po_id: int) -> PurchaseOrder | None:
    return _load_po_query(db).filter(PurchaseOrder.id == po_id).first()


def create_purchase_order(db: Session, po_in: PurchaseOrderCreate) -> PurchaseOrder:
    db_po = PurchaseOrder(
        po_no=next_sequence_number(db, PurchaseOrder.po_no, "PO-", 5),
        po_date=po_in.po_date,
        vendor_id=po_in.vendor_id,
        project_id=po_in.project_id,
        status=po_in.status,
        narration=po_in.narration,
    )
    db.add(db_po)
    db.flush()

    for line in po_in.lines:
        amount = round(line.quantity * line.rate, 2)
        db.add(
            PurchaseOrderLine(
                po_id=db_po.id,
                material_id=line.material_id,
                quantity=line.quantity,
                rate=line.rate,
                amount=amount,
            )
        )

    db.commit()
    return get_purchase_order(db, db_po.id)


def update_purchase_order(
    db: Session, db_po: PurchaseOrder, po_in: PurchaseOrderUpdate
) -> PurchaseOrder:
    for field, value in po_in.model_dump(exclude_unset=True).items():
        setattr(db_po, field, value)
    db.commit()
    return get_purchase_order(db, db_po.id)


def delete_purchase_order(db: Session, db_po: PurchaseOrder) -> None:
    grn_count = db.query(GRN).filter(GRN.po_id == db_po.id).count()
    if grn_count:
        raise ValueError(
            f"This purchase order has {grn_count} GRN(s) recorded against it and cannot be deleted."
        )
    db.delete(db_po)
    db.commit()


# Stock ledger helpers


def _get_current_balance(
    db: Session, material_id: int, warehouse_id: int | None, project_id: int | None = None
) -> tuple[float, float]:
    """Balance is keyed by warehouse when the stock lives in a warehouse. Only
    when there is no warehouse (material received or held directly at a
    project/site) does project_id become part of the key — otherwise it's
    just a reporting tag and every warehouse-bound movement shares the one
    warehouse balance regardless of which project it's tagged with."""
    query = db.query(StockLedger).filter(StockLedger.material_id == material_id)
    if warehouse_id is not None:
        query = query.filter(StockLedger.warehouse_id == warehouse_id)
    else:
        query = query.filter(StockLedger.warehouse_id.is_(None), StockLedger.project_id == project_id)
    last = query.order_by(StockLedger.id.desc()).first()
    if not last:
        return 0.0, 0.0
    return float(last.balance_qty), float(last.balance_value)


def _post_stock_movement(
    db: Session,
    *,
    material_id: int,
    warehouse_id: int | None,
    project_id: int | None = None,
    movement_date,
    movement_type: StockMovementType,
    ref_type: StockRefType,
    ref_id: int,
    quantity: float,
    rate: float,
) -> StockLedger:
    # project_id only matters for the balance key in the no-warehouse (direct
    # to site) case — see _get_current_balance.
    balance_project_id = project_id if warehouse_id is None else None
    prev_qty, prev_value = _get_current_balance(db, material_id, warehouse_id, balance_project_id)
    amount = round(quantity * rate, 2)

    if movement_type == StockMovementType.IN:
        balance_qty = prev_qty + quantity
        balance_value = prev_value + amount
    else:
        balance_qty = prev_qty - quantity
        balance_value = prev_value - amount

    entry = StockLedger(
        material_id=material_id,
        warehouse_id=warehouse_id,
        project_id=project_id,
        movement_date=movement_date,
        movement_type=movement_type,
        ref_type=ref_type,
        ref_id=ref_id,
        quantity=quantity,
        rate=rate,
        amount=amount,
        balance_qty=balance_qty,
        balance_value=balance_value,
    )
    db.add(entry)
    return entry


def _assert_latest_movement(
    db: Session,
    material_id: int,
    warehouse_id: int | None,
    ref_type: StockRefType,
    ref_id: int,
    doc_label: str,
    project_id: int | None = None,
) -> None:
    """Only the most recent stock-affecting document per material/warehouse (or,
    for a direct-to-project receipt, per material/project) can be deleted, since
    balance_qty/balance_value are computed incrementally from the prior row
    rather than recalculated on every change."""
    query = db.query(StockLedger).filter(StockLedger.material_id == material_id)
    if warehouse_id is not None:
        query = query.filter(StockLedger.warehouse_id == warehouse_id)
    else:
        query = query.filter(StockLedger.warehouse_id.is_(None), StockLedger.project_id == project_id)
    latest = query.order_by(StockLedger.id.desc()).first()
    if latest and (latest.ref_type != ref_type or latest.ref_id != ref_id):
        material = db.query(Material).filter(Material.id == material_id).first()
        name = material.name if material else f"material #{material_id}"
        raise ValueError(
            f"Cannot delete {doc_label}: stock for {name} has moved since this document was "
            "recorded. Delete the more recent GRN/Material Issue for this material first."
        )


# GRN


def _load_grn_query(db: Session):
    return db.query(GRN).options(
        joinedload(GRN.vendor),
        joinedload(GRN.project),
        joinedload(GRN.payment_account),
        joinedload(GRN.lines).joinedload(GRNLine.material),
    )


def list_grns(db: Session, project_id: int | None = None, vendor_id: int | None = None) -> list[GRN]:
    query = _load_grn_query(db)
    if project_id is not None:
        query = query.filter(GRN.project_id == project_id)
    if vendor_id is not None:
        query = query.filter(GRN.vendor_id == vendor_id)
    return query.order_by(GRN.id.desc()).all()


def get_grn(db: Session, grn_id: int) -> GRN | None:
    return _load_grn_query(db).filter(GRN.id == grn_id).first()


def create_grn(db: Session, grn_in: GRNCreate) -> GRN:
    vendor = db.query(Vendor).filter(Vendor.id == grn_in.vendor_id).first()
    if not vendor:
        raise ValueError("Vendor not found")

    material_stock_account = _get_account_by_code(db, MATERIAL_STOCK_ACCOUNT_CODE)

    total_amount = 0.0
    line_data = []
    for line in grn_in.lines:
        amount = round(line.quantity * line.rate, 2)
        total_amount += amount
        line_data.append((line, amount))

    db_grn = GRN(
        grn_no=next_sequence_number(db, GRN.grn_no, "GRN-", 5),
        grn_date=grn_in.grn_date,
        vendor_id=grn_in.vendor_id,
        warehouse_id=grn_in.warehouse_id,
        project_id=grn_in.project_id,
        po_id=grn_in.po_id,
        payment_account_id=grn_in.payment_account_id,
        total_amount=total_amount,
        narration=grn_in.narration,
    )
    db.add(db_grn)
    db.flush()

    for line, amount in line_data:
        db.add(
            GRNLine(
                grn_id=db_grn.id,
                material_id=line.material_id,
                quantity=line.quantity,
                rate=line.rate,
                amount=amount,
            )
        )
        _post_stock_movement(
            db,
            material_id=line.material_id,
            warehouse_id=grn_in.warehouse_id,
            project_id=grn_in.project_id,
            movement_date=grn_in.grn_date,
            movement_type=StockMovementType.IN,
            ref_type=StockRefType.GRN,
            ref_id=db_grn.id,
            quantity=line.quantity,
            rate=line.rate,
        )

    voucher = Voucher(
        voucher_no=_next_journal_voucher_no(db),
        voucher_type=VoucherType.JOURNAL,
        voucher_date=grn_in.grn_date,
        project_id=grn_in.project_id,
        narration=f"GRN {db_grn.grn_no} — {vendor.name}",
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=material_stock_account.id,
            debit=total_amount,
            credit=0,
            narration=f"GRN {db_grn.grn_no}",
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=grn_in.payment_account_id,
            debit=0,
            credit=total_amount,
            narration=f"GRN {db_grn.grn_no}",
        )
    )

    db_grn.voucher_id = voucher.id

    if grn_in.po_id:
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == grn_in.po_id).first()
        if po and po.status not in (PurchaseOrderStatus.CLOSED, PurchaseOrderStatus.CANCELLED):
            po.status = PurchaseOrderStatus.CLOSED

    db.commit()
    return get_grn(db, db_grn.id)


def delete_grn(db: Session, db_grn: GRN) -> None:
    for line in db_grn.lines:
        _assert_latest_movement(
            db,
            line.material_id,
            db_grn.warehouse_id,
            StockRefType.GRN,
            db_grn.id,
            f"GRN {db_grn.grn_no}",
            project_id=db_grn.project_id if db_grn.warehouse_id is None else None,
        )

    db.query(StockLedger).filter(
        StockLedger.ref_type == StockRefType.GRN, StockLedger.ref_id == db_grn.id
    ).delete()

    # The GRN row must be gone before its voucher is deleted — grns.voucher_id is a
    # live FK, so deleting the voucher first trips a FK constraint violation.
    voucher_id = db_grn.voucher_id
    po_id = db_grn.po_id
    db.delete(db_grn)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    if po_id:
        po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
        if po and po.status == PurchaseOrderStatus.CLOSED:
            po.status = PurchaseOrderStatus.APPROVED

    db.commit()


# Material Issue


def _load_issue_query(db: Session):
    return db.query(MaterialIssue).options(
        joinedload(MaterialIssue.project),
        joinedload(MaterialIssue.lines).joinedload(MaterialIssueLine.material),
    )


def list_material_issues(db: Session, project_id: int | None = None) -> list[MaterialIssue]:
    query = _load_issue_query(db)
    if project_id is not None:
        query = query.filter(MaterialIssue.project_id == project_id)
    return query.order_by(MaterialIssue.id.desc()).all()


def get_material_issue(db: Session, issue_id: int) -> MaterialIssue | None:
    return _load_issue_query(db).filter(MaterialIssue.id == issue_id).first()


def create_material_issue(db: Session, issue_in: MaterialIssueCreate) -> MaterialIssue:
    expense_account = (
        _get_or_create_wastage_account(db)
        if issue_in.reason == MaterialIssueReason.DAMAGED
        else _get_account_by_code(db, MATERIAL_CONSUMPTION_ACCOUNT_CODE)
    )
    material_stock_account = _get_account_by_code(db, MATERIAL_STOCK_ACCOUNT_CODE)

    total_amount = 0.0
    line_data = []
    for line in issue_in.lines:
        balance_qty, balance_value = _get_current_balance(db, line.material_id, issue_in.warehouse_id)
        if line.quantity > balance_qty:
            material = db.query(Material).filter(Material.id == line.material_id).first()
            name = material.name if material else f"material #{line.material_id}"
            raise ValueError(
                f"Insufficient stock for {name}: available {balance_qty}, requested {line.quantity}"
            )
        rate = (balance_value / balance_qty) if balance_qty > 0 else 0.0
        amount = round(line.quantity * rate, 2)
        total_amount += amount
        line_data.append((line, rate, amount))

    db_issue = MaterialIssue(
        issue_no=next_sequence_number(db, MaterialIssue.issue_no, "MIS-", 5),
        issue_date=issue_in.issue_date,
        project_id=issue_in.project_id,
        warehouse_id=issue_in.warehouse_id,
        reason=issue_in.reason,
        issued_to=issue_in.issued_to,
        narration=issue_in.narration,
    )
    db.add(db_issue)
    db.flush()

    for line, rate, amount in line_data:
        db.add(
            MaterialIssueLine(
                issue_id=db_issue.id,
                material_id=line.material_id,
                quantity=line.quantity,
                rate=rate,
                amount=amount,
            )
        )
        _post_stock_movement(
            db,
            material_id=line.material_id,
            warehouse_id=issue_in.warehouse_id,
            project_id=issue_in.project_id,
            movement_date=issue_in.issue_date,
            movement_type=StockMovementType.OUT,
            ref_type=StockRefType.ISSUE,
            ref_id=db_issue.id,
            quantity=line.quantity,
            rate=rate,
        )

    voucher_narration = (
        f"Material Issue {db_issue.issue_no} ({issue_in.reason.value})"
    )
    voucher = Voucher(
        voucher_no=_next_journal_voucher_no(db),
        voucher_type=VoucherType.JOURNAL,
        voucher_date=issue_in.issue_date,
        project_id=issue_in.project_id,
        narration=voucher_narration,
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=expense_account.id,
            debit=total_amount,
            credit=0,
            narration=voucher_narration,
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=material_stock_account.id,
            debit=0,
            credit=total_amount,
            narration=voucher_narration,
        )
    )

    db_issue.voucher_id = voucher.id
    db.commit()
    return get_material_issue(db, db_issue.id)


def delete_material_issue(db: Session, db_issue: MaterialIssue) -> None:
    for line in db_issue.lines:
        _assert_latest_movement(
            db,
            line.material_id,
            db_issue.warehouse_id,
            StockRefType.ISSUE,
            db_issue.id,
            f"Material Issue {db_issue.issue_no}",
        )

    db.query(StockLedger).filter(
        StockLedger.ref_type == StockRefType.ISSUE, StockLedger.ref_id == db_issue.id
    ).delete()

    # Same ordering requirement as delete_grn: delete the issue before its voucher.
    voucher_id = db_issue.voucher_id
    db.delete(db_issue)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()


def resolve_material_issue(
    db: Session, db_issue: MaterialIssue, resolution_note: str | None, restock: bool
) -> MaterialIssue:
    if db_issue.resolved:
        raise ValueError(f"{db_issue.issue_no} has already been resolved")

    today = date.today()

    if restock:
        wastage_account = _get_or_create_wastage_account(db)
        material_stock_account = _get_account_by_code(db, MATERIAL_STOCK_ACCOUNT_CODE)
        total_amount = 0.0

        for line in db_issue.lines:
            _post_stock_movement(
                db,
                material_id=line.material_id,
                warehouse_id=db_issue.warehouse_id,
                project_id=db_issue.project_id,
                movement_date=today,
                movement_type=StockMovementType.IN,
                ref_type=StockRefType.RESTOCK,
                ref_id=db_issue.id,
                quantity=float(line.quantity),
                rate=float(line.rate),
            )
            total_amount += float(line.amount)

        voucher_narration = f"Restock — {db_issue.issue_no} resolved (vendor replacement)"
        voucher = Voucher(
            voucher_no=_next_journal_voucher_no(db),
            voucher_type=VoucherType.JOURNAL,
            voucher_date=today,
            project_id=db_issue.project_id,
            narration=voucher_narration,
        )
        db.add(voucher)
        db.flush()

        db.add(
            VoucherLine(
                voucher_id=voucher.id,
                account_id=material_stock_account.id,
                debit=total_amount,
                credit=0,
                narration=voucher_narration,
            )
        )
        db.add(
            VoucherLine(
                voucher_id=voucher.id,
                account_id=wastage_account.id,
                debit=0,
                credit=total_amount,
                narration=voucher_narration,
            )
        )
        db_issue.restocked = True

    db_issue.resolved = True
    db_issue.resolved_date = today
    db_issue.resolution_note = resolution_note
    db.commit()
    return get_material_issue(db, db_issue.id)


def mark_material_issue_received(
    db: Session, db_issue: MaterialIssue, received_by: str
) -> MaterialIssue:
    if db_issue.status == MaterialIssueStatus.RECEIVED:
        raise ValueError(f"{db_issue.issue_no} has already been marked received")

    db_issue.status = MaterialIssueStatus.RECEIVED
    db_issue.received_date = date.today()
    db_issue.received_by = received_by
    db.commit()
    return get_material_issue(db, db_issue.id)


# Opening Stock


def _load_opening_stock_query(db: Session):
    return db.query(OpeningStock).options(
        joinedload(OpeningStock.material),
        joinedload(OpeningStock.warehouse),
        joinedload(OpeningStock.project),
    )


def list_opening_stocks(db: Session) -> list[OpeningStock]:
    return _load_opening_stock_query(db).order_by(OpeningStock.id.desc()).all()


def get_opening_stock(db: Session, opening_id: int) -> OpeningStock | None:
    return _load_opening_stock_query(db).filter(OpeningStock.id == opening_id).first()


def create_opening_stock(db: Session, opening_in: OpeningStockCreate) -> OpeningStock:
    material_stock_account = _get_account_by_code(db, MATERIAL_STOCK_ACCOUNT_CODE)
    owner_capital_account = _get_account_by_code(db, OWNER_CAPITAL_ACCOUNT_CODE)

    amount = round(opening_in.quantity * opening_in.rate, 2)

    db_opening = OpeningStock(
        opening_no=next_sequence_number(db, OpeningStock.opening_no, "OPN-", 5),
        opening_date=opening_in.opening_date,
        material_id=opening_in.material_id,
        quantity=opening_in.quantity,
        rate=opening_in.rate,
        amount=amount,
        warehouse_id=opening_in.warehouse_id,
        project_id=opening_in.project_id,
        narration=opening_in.narration,
    )
    db.add(db_opening)
    db.flush()

    _post_stock_movement(
        db,
        material_id=opening_in.material_id,
        warehouse_id=opening_in.warehouse_id,
        project_id=opening_in.project_id,
        movement_date=opening_in.opening_date,
        movement_type=StockMovementType.IN,
        ref_type=StockRefType.OPENING,
        ref_id=db_opening.id,
        quantity=opening_in.quantity,
        rate=opening_in.rate,
    )

    voucher_narration = f"Opening Stock {db_opening.opening_no}"
    voucher = Voucher(
        voucher_no=_next_journal_voucher_no(db),
        voucher_type=VoucherType.JOURNAL,
        voucher_date=opening_in.opening_date,
        project_id=opening_in.project_id,
        narration=voucher_narration,
    )
    db.add(voucher)
    db.flush()

    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=material_stock_account.id,
            debit=amount,
            credit=0,
            narration=voucher_narration,
        )
    )
    db.add(
        VoucherLine(
            voucher_id=voucher.id,
            account_id=owner_capital_account.id,
            debit=0,
            credit=amount,
            narration=voucher_narration,
        )
    )

    db_opening.voucher_id = voucher.id
    db.commit()
    return get_opening_stock(db, db_opening.id)


def delete_opening_stock(db: Session, db_opening: OpeningStock) -> None:
    _assert_latest_movement(
        db,
        db_opening.material_id,
        db_opening.warehouse_id,
        StockRefType.OPENING,
        db_opening.id,
        f"Opening Stock {db_opening.opening_no}",
        project_id=db_opening.project_id if db_opening.warehouse_id is None else None,
    )

    db.query(StockLedger).filter(
        StockLedger.ref_type == StockRefType.OPENING, StockLedger.ref_id == db_opening.id
    ).delete()

    voucher_id = db_opening.voucher_id
    db.delete(db_opening)
    db.flush()

    if voucher_id:
        voucher = db.query(Voucher).filter(Voucher.id == voucher_id).first()
        if voucher:
            db.delete(voucher)

    db.commit()


# Material Transfer


def _load_transfer_query(db: Session):
    return db.query(MaterialTransfer).options(
        joinedload(MaterialTransfer.material),
        joinedload(MaterialTransfer.from_warehouse),
        joinedload(MaterialTransfer.from_project),
        joinedload(MaterialTransfer.to_warehouse),
        joinedload(MaterialTransfer.to_project),
    )


def list_material_transfers(db: Session) -> list[MaterialTransfer]:
    return _load_transfer_query(db).order_by(MaterialTransfer.id.desc()).all()


def get_material_transfer(db: Session, transfer_id: int) -> MaterialTransfer | None:
    return _load_transfer_query(db).filter(MaterialTransfer.id == transfer_id).first()


def create_material_transfer(db: Session, transfer_in: MaterialTransferCreate) -> MaterialTransfer:
    from_balance_project_id = transfer_in.from_project_id if transfer_in.from_warehouse_id is None else None
    balance_qty, balance_value = _get_current_balance(
        db, transfer_in.material_id, transfer_in.from_warehouse_id, from_balance_project_id
    )
    if transfer_in.quantity > balance_qty:
        material = db.query(Material).filter(Material.id == transfer_in.material_id).first()
        name = material.name if material else f"material #{transfer_in.material_id}"
        raise ValueError(
            f"Insufficient stock for {name} at the source: available {balance_qty}, "
            f"requested {transfer_in.quantity}"
        )

    rate = (balance_value / balance_qty) if balance_qty > 0 else 0.0
    amount = round(transfer_in.quantity * rate, 2)

    db_transfer = MaterialTransfer(
        transfer_no=next_sequence_number(db, MaterialTransfer.transfer_no, "MTR-", 5),
        transfer_date=transfer_in.transfer_date,
        material_id=transfer_in.material_id,
        quantity=transfer_in.quantity,
        rate=rate,
        amount=amount,
        from_warehouse_id=transfer_in.from_warehouse_id,
        from_project_id=transfer_in.from_project_id,
        to_warehouse_id=transfer_in.to_warehouse_id,
        to_project_id=transfer_in.to_project_id,
        narration=transfer_in.narration,
    )
    db.add(db_transfer)
    db.flush()

    _post_stock_movement(
        db,
        material_id=transfer_in.material_id,
        warehouse_id=transfer_in.from_warehouse_id,
        project_id=transfer_in.from_project_id,
        movement_date=transfer_in.transfer_date,
        movement_type=StockMovementType.OUT,
        ref_type=StockRefType.TRANSFER,
        ref_id=db_transfer.id,
        quantity=transfer_in.quantity,
        rate=rate,
    )
    _post_stock_movement(
        db,
        material_id=transfer_in.material_id,
        warehouse_id=transfer_in.to_warehouse_id,
        project_id=transfer_in.to_project_id,
        movement_date=transfer_in.transfer_date,
        movement_type=StockMovementType.IN,
        ref_type=StockRefType.TRANSFER,
        ref_id=db_transfer.id,
        quantity=transfer_in.quantity,
        rate=rate,
    )

    db.commit()
    return get_material_transfer(db, db_transfer.id)


def delete_material_transfer(db: Session, db_transfer: MaterialTransfer) -> None:
    from_project_id = db_transfer.from_project_id if db_transfer.from_warehouse_id is None else None
    to_project_id = db_transfer.to_project_id if db_transfer.to_warehouse_id is None else None
    _assert_latest_movement(
        db,
        db_transfer.material_id,
        db_transfer.from_warehouse_id,
        StockRefType.TRANSFER,
        db_transfer.id,
        f"Material Transfer {db_transfer.transfer_no}",
        project_id=from_project_id,
    )
    _assert_latest_movement(
        db,
        db_transfer.material_id,
        db_transfer.to_warehouse_id,
        StockRefType.TRANSFER,
        db_transfer.id,
        f"Material Transfer {db_transfer.transfer_no}",
        project_id=to_project_id,
    )

    db.query(StockLedger).filter(
        StockLedger.ref_type == StockRefType.TRANSFER, StockLedger.ref_id == db_transfer.id
    ).delete()

    db.delete(db_transfer)
    db.commit()


# Stock balance summary


def get_stock_balances(
    db: Session, warehouse_id: int | None = None, material_id: int | None = None
) -> list[dict]:
    # warehouse_id IS NULL rows are stock received/held directly at a project
    # (no warehouse stop) — that's the "By Project" view's stock, not this one's.
    latest_subq = (
        db.query(
            StockLedger.material_id,
            StockLedger.warehouse_id,
            func.max(StockLedger.id).label("latest_id"),
        )
        .filter(StockLedger.warehouse_id.isnot(None))
        .group_by(StockLedger.material_id, StockLedger.warehouse_id)
    )

    if warehouse_id is not None:
        latest_subq = latest_subq.filter(StockLedger.warehouse_id == warehouse_id)
    if material_id is not None:
        latest_subq = latest_subq.filter(StockLedger.material_id == material_id)

    latest_subq = latest_subq.subquery()

    rows = (
        db.query(StockLedger, Material, Warehouse)
        .join(latest_subq, StockLedger.id == latest_subq.c.latest_id)
        .join(Material, Material.id == StockLedger.material_id)
        .outerjoin(Warehouse, Warehouse.id == StockLedger.warehouse_id)
        .order_by(Material.name)
        .all()
    )

    result = [
        {
            "material_id": ledger.material_id,
            "material_code": material.material_code,
            "material_name": material.name,
            "unit_of_measure": material.unit_of_measure,
            "warehouse_id": ledger.warehouse_id,
            "warehouse_name": warehouse.name if warehouse else None,
            "balance_qty": float(ledger.balance_qty),
            "balance_value": float(ledger.balance_value),
        }
        for ledger, material, warehouse in rows
    ]

    # A material with no GRN/Issue yet has no stock_ledger row at all, so the join
    # above silently omits it. Without a warehouse filter, list it anyway at zero —
    # otherwise a freshly-added material just looks "missing" from the balance
    # sheet instead of reading as not-yet-received.
    if warehouse_id is None:
        touched_material_ids = {r["material_id"] for r in result}
        materials_query = db.query(Material)
        if material_id is not None:
            materials_query = materials_query.filter(Material.id == material_id)
        for material in materials_query.order_by(Material.name).all():
            if material.id not in touched_material_ids:
                result.append(
                    {
                        "material_id": material.id,
                        "material_code": material.material_code,
                        "material_name": material.name,
                        "unit_of_measure": material.unit_of_measure,
                        "warehouse_id": None,
                        "warehouse_name": None,
                        "balance_qty": 0.0,
                        "balance_value": 0.0,
                    }
                )
        result.sort(key=lambda r: r["material_name"])

    return result


def get_project_stock(
    db: Session, project_id: int | None = None, material_id: int | None = None
) -> list[dict]:
    """Material available at each project/site, combining two sources:
    (a) warehouse dispatches confirmed received on site (summed from Material
    Issue lines whose delivery status is Received — not a live perpetual
    balance, just a running total of what's arrived so far), and
    (b) material bought and received directly at the site with no warehouse
    stop (a GRN with no warehouse — a perpetual per-project balance in the
    stock ledger, same mechanism as warehouse stock but keyed by project)."""
    issue_query = (
        db.query(
            MaterialIssueLine.material_id,
            MaterialIssue.project_id,
            func.sum(MaterialIssueLine.quantity).label("qty"),
            func.sum(MaterialIssueLine.amount).label("value"),
        )
        .join(MaterialIssue, MaterialIssue.id == MaterialIssueLine.issue_id)
        .filter(MaterialIssue.status == MaterialIssueStatus.RECEIVED)
        .group_by(MaterialIssueLine.material_id, MaterialIssue.project_id)
    )
    if project_id is not None:
        issue_query = issue_query.filter(MaterialIssue.project_id == project_id)
    if material_id is not None:
        issue_query = issue_query.filter(MaterialIssueLine.material_id == material_id)

    totals: dict[tuple[int, int], dict[str, float]] = {}
    for row_material_id, row_project_id, qty, value in issue_query.all():
        totals[(row_material_id, row_project_id)] = {"qty": float(qty), "value": float(value)}

    direct_subq = (
        db.query(
            StockLedger.material_id,
            StockLedger.project_id,
            func.max(StockLedger.id).label("latest_id"),
        )
        .filter(StockLedger.warehouse_id.is_(None), StockLedger.project_id.isnot(None))
        .group_by(StockLedger.material_id, StockLedger.project_id)
    )
    if project_id is not None:
        direct_subq = direct_subq.filter(StockLedger.project_id == project_id)
    if material_id is not None:
        direct_subq = direct_subq.filter(StockLedger.material_id == material_id)
    direct_subq = direct_subq.subquery()

    direct_rows = (
        db.query(StockLedger).join(direct_subq, StockLedger.id == direct_subq.c.latest_id).all()
    )
    for ledger in direct_rows:
        key = (ledger.material_id, ledger.project_id)
        existing = totals.get(key, {"qty": 0.0, "value": 0.0})
        totals[key] = {
            "qty": existing["qty"] + float(ledger.balance_qty),
            "value": existing["value"] + float(ledger.balance_value),
        }

    if not totals:
        return []

    material_ids = {k[0] for k in totals}
    project_ids = {k[1] for k in totals}
    materials = {m.id: m for m in db.query(Material).filter(Material.id.in_(material_ids)).all()}
    projects = {p.id: p for p in db.query(Project).filter(Project.id.in_(project_ids)).all()}

    result = []
    for (row_material_id, row_project_id), sums in totals.items():
        material = materials.get(row_material_id)
        project = projects.get(row_project_id)
        result.append(
            {
                "material_id": row_material_id,
                "material_code": material.material_code if material else "",
                "material_name": material.name if material else "",
                "unit_of_measure": material.unit_of_measure if material else "",
                "project_id": row_project_id,
                "project_name": project.project_name if project else None,
                "balance_qty": sums["qty"],
                "balance_value": sums["value"],
            }
        )
    result.sort(key=lambda r: r["material_name"])
    return result
