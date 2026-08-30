from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import inventory as inventory_crud
from app.db.session import get_db
from app.schemas.inventory import (
    GRNCreate,
    GRNOut,
    MaterialCreate,
    MaterialIssueCreate,
    MaterialIssueOut,
    MaterialIssueResolve,
    MaterialOut,
    MaterialUpdate,
    PurchaseOrderCreate,
    PurchaseOrderOut,
    PurchaseOrderUpdate,
    StockBalanceOut,
    VendorCreate,
    VendorOut,
    VendorUpdate,
)

router = APIRouter()


# Vendors


@router.get("/vendors", response_model=list[VendorOut])
def list_vendors(is_active: bool | None = None, db: Session = Depends(get_db)):
    return inventory_crud.list_vendors(db, is_active=is_active)


@router.post("/vendors", response_model=VendorOut, status_code=status.HTTP_201_CREATED)
def create_vendor(vendor_in: VendorCreate, db: Session = Depends(get_db)):
    return inventory_crud.create_vendor(db, vendor_in)


@router.put("/vendors/{vendor_id}", response_model=VendorOut)
def update_vendor(vendor_id: int, vendor_in: VendorUpdate, db: Session = Depends(get_db)):
    db_vendor = inventory_crud.get_vendor(db, vendor_id)
    if not db_vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return inventory_crud.update_vendor(db, db_vendor, vendor_in)


@router.delete("/vendors/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    db_vendor = inventory_crud.get_vendor(db, vendor_id)
    if not db_vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    delete_with_fk_guard(db, lambda: inventory_crud.delete_vendor(db, db_vendor), "vendor")


# Materials


@router.get("/materials", response_model=list[MaterialOut])
def list_materials(is_active: bool | None = None, db: Session = Depends(get_db)):
    return inventory_crud.list_materials(db, is_active=is_active)


@router.post("/materials", response_model=MaterialOut, status_code=status.HTTP_201_CREATED)
def create_material(material_in: MaterialCreate, db: Session = Depends(get_db)):
    return inventory_crud.create_material(db, material_in)


@router.put("/materials/{material_id}", response_model=MaterialOut)
def update_material(material_id: int, material_in: MaterialUpdate, db: Session = Depends(get_db)):
    db_material = inventory_crud.get_material(db, material_id)
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")
    return inventory_crud.update_material(db, db_material, material_in)


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material(material_id: int, db: Session = Depends(get_db)):
    db_material = inventory_crud.get_material(db, material_id)
    if not db_material:
        raise HTTPException(status_code=404, detail="Material not found")
    delete_with_fk_guard(db, lambda: inventory_crud.delete_material(db, db_material), "material")


# Purchase Orders


@router.get("/purchase-orders", response_model=list[PurchaseOrderOut])
def list_purchase_orders(
    project_id: int | None = None, vendor_id: int | None = None, db: Session = Depends(get_db)
):
    return inventory_crud.list_purchase_orders(db, project_id=project_id, vendor_id=vendor_id)


@router.post("/purchase-orders", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(po_in: PurchaseOrderCreate, db: Session = Depends(get_db)):
    try:
        return inventory_crud.create_purchase_order(db, po_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderOut)
def get_purchase_order(po_id: int, db: Session = Depends(get_db)):
    db_po = inventory_crud.get_purchase_order(db, po_id)
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return db_po


@router.put("/purchase-orders/{po_id}", response_model=PurchaseOrderOut)
def update_purchase_order(po_id: int, po_in: PurchaseOrderUpdate, db: Session = Depends(get_db)):
    db_po = inventory_crud.get_purchase_order(db, po_id)
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return inventory_crud.update_purchase_order(db, db_po, po_in)


@router.delete("/purchase-orders/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(po_id: int, db: Session = Depends(get_db)):
    db_po = inventory_crud.get_purchase_order(db, po_id)
    if not db_po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    delete_with_fk_guard(
        db, lambda: inventory_crud.delete_purchase_order(db, db_po), "purchase order"
    )


# GRN


@router.get("/grn", response_model=list[GRNOut])
def list_grns(project_id: int | None = None, vendor_id: int | None = None, db: Session = Depends(get_db)):
    return inventory_crud.list_grns(db, project_id=project_id, vendor_id=vendor_id)


@router.post("/grn", response_model=GRNOut, status_code=status.HTTP_201_CREATED)
def create_grn(grn_in: GRNCreate, db: Session = Depends(get_db)):
    try:
        return inventory_crud.create_grn(db, grn_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/grn/{grn_id}", response_model=GRNOut)
def get_grn(grn_id: int, db: Session = Depends(get_db)):
    db_grn = inventory_crud.get_grn(db, grn_id)
    if not db_grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    return db_grn


@router.delete("/grn/{grn_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grn(grn_id: int, db: Session = Depends(get_db)):
    db_grn = inventory_crud.get_grn(db, grn_id)
    if not db_grn:
        raise HTTPException(status_code=404, detail="GRN not found")
    delete_with_fk_guard(db, lambda: inventory_crud.delete_grn(db, db_grn), "GRN")


# Material Issues


@router.get("/issues", response_model=list[MaterialIssueOut])
def list_material_issues(project_id: int | None = None, db: Session = Depends(get_db)):
    return inventory_crud.list_material_issues(db, project_id=project_id)


@router.post("/issues", response_model=MaterialIssueOut, status_code=status.HTTP_201_CREATED)
def create_material_issue(issue_in: MaterialIssueCreate, db: Session = Depends(get_db)):
    try:
        return inventory_crud.create_material_issue(db, issue_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/issues/{issue_id}", response_model=MaterialIssueOut)
def get_material_issue(issue_id: int, db: Session = Depends(get_db)):
    db_issue = inventory_crud.get_material_issue(db, issue_id)
    if not db_issue:
        raise HTTPException(status_code=404, detail="Material issue not found")
    return db_issue


@router.delete("/issues/{issue_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_material_issue(issue_id: int, db: Session = Depends(get_db)):
    db_issue = inventory_crud.get_material_issue(db, issue_id)
    if not db_issue:
        raise HTTPException(status_code=404, detail="Material issue not found")
    delete_with_fk_guard(
        db, lambda: inventory_crud.delete_material_issue(db, db_issue), "material issue"
    )


@router.put("/issues/{issue_id}/resolve", response_model=MaterialIssueOut)
def resolve_material_issue(issue_id: int, payload: MaterialIssueResolve, db: Session = Depends(get_db)):
    db_issue = inventory_crud.get_material_issue(db, issue_id)
    if not db_issue:
        raise HTTPException(status_code=404, detail="Material issue not found")
    try:
        return inventory_crud.resolve_material_issue(
            db, db_issue, payload.resolution_note, payload.restock
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# Stock balance


@router.get("/stock", response_model=list[StockBalanceOut])
def get_stock_balances(
    project_id: int | None = None, material_id: int | None = None, db: Session = Depends(get_db)
):
    return inventory_crud.get_stock_balances(db, project_id=project_id, material_id=material_id)
