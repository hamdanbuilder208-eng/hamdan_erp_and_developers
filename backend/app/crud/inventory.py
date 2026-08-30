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
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderStatus,
    StockLedger,
    StockMovementType,
    StockRefType,
    Vendor,
)
from app.models.project import Project
from app.models.voucher import Voucher, VoucherLine, VoucherType
from app.schemas.inventory import (
    GRNCreate,
    MaterialCreate,
    MaterialIssueCreate,
    MaterialUpdate,
    PurchaseOrderCreate,
    PurchaseOrderUpdate,
    VendorCreate,
    VendorUpdate,
)

MATERIAL_STOCK_ACCOUNT_CODE = "1040"
MATERIAL_CONSUMPTION_ACCOUNT_CODE = "5050"
MATERIAL_WASTAGE_ACCOUNT_CODE = "5060"


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


def _get_current_balance(db: Session, material_id: int, project_id: int | None) -> tuple[float, float]:
    last = (
        db.query(StockLedger)
        .filter(StockLedger.material_id == material_id, StockLedger.project_id == project_id)
        .order_by(StockLedger.id.desc())
        .first()
    )
    if not last:
        return 0.0, 0.0
    return float(last.balance_qty), float(last.balance_value)


def _post_stock_movement(
    db: Session,
    *,
    material_id: int,
    project_id: int | None,
    movement_date,
    movement_type: StockMovementType,
    ref_type: StockRefType,
    ref_id: int,
    quantity: float,
    rate: float,
) -> StockLedger:
    prev_qty, prev_value = _get_current_balance(db, material_id, project_id)
    amount = round(quantity * rate, 2)

    if movement_type == StockMovementType.IN:
        balance_qty = prev_qty + quantity
        balance_value = prev_value + amount
    else:
        balance_qty = prev_qty - quantity
        balance_value = prev_value - amount

    entry = StockLedger(
        material_id=material_id,
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
    db: Session, material_id: int, project_id: int | None, ref_type: StockRefType, ref_id: int, doc_label: str
) -> None:
    """Only the most recent stock-affecting document per material/project can be
    deleted, since balance_qty/balance_value are computed incrementally from the
    prior row rather than recalculated on every change."""
    latest = (
        db.query(StockLedger)
        .filter(StockLedger.material_id == material_id, StockLedger.project_id == project_id)
        .order_by(StockLedger.id.desc())
        .first()
    )
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
            db, line.material_id, db_grn.project_id, StockRefType.GRN, db_grn.id, f"GRN {db_grn.grn_no}"
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
        balance_qty, balance_value = _get_current_balance(db, line.material_id, issue_in.project_id)
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
            db_issue.project_id,
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


# Stock balance summary


def get_stock_balances(
    db: Session, project_id: int | None = None, material_id: int | None = None
) -> list[dict]:
    latest_subq = db.query(
        StockLedger.material_id,
        StockLedger.project_id,
        func.max(StockLedger.id).label("latest_id"),
    ).group_by(StockLedger.material_id, StockLedger.project_id)

    if project_id is not None:
        latest_subq = latest_subq.filter(StockLedger.project_id == project_id)
    if material_id is not None:
        latest_subq = latest_subq.filter(StockLedger.material_id == material_id)

    latest_subq = latest_subq.subquery()

    rows = (
        db.query(StockLedger, Material, Project)
        .join(latest_subq, StockLedger.id == latest_subq.c.latest_id)
        .join(Material, Material.id == StockLedger.material_id)
        .outerjoin(Project, Project.id == StockLedger.project_id)
        .order_by(Material.name)
        .all()
    )

    result = [
        {
            "material_id": ledger.material_id,
            "material_code": material.material_code,
            "material_name": material.name,
            "unit_of_measure": material.unit_of_measure,
            "project_id": ledger.project_id,
            "project_name": project.project_name if project else None,
            "balance_qty": float(ledger.balance_qty),
            "balance_value": float(ledger.balance_value),
        }
        for ledger, material, project in rows
    ]

    # A material with no GRN/Issue yet has no stock_ledger row at all, so the join
    # above silently omits it. Without a project filter, list it anyway at zero —
    # otherwise a freshly-added material just looks "missing" from the balance
    # sheet instead of reading as not-yet-received.
    if project_id is None:
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
                        "project_id": None,
                        "project_name": None,
                        "balance_qty": 0.0,
                        "balance_value": 0.0,
                    }
                )
        result.sort(key=lambda r: r["material_name"])

    return result
