from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import voucher as voucher_crud
from app.db.session import get_db
from app.models.voucher import VoucherType
from app.schemas.voucher import VoucherCreate, VoucherOut

router = APIRouter()


@router.get("/", response_model=list[VoucherOut])
def list_vouchers(
    voucher_type: VoucherType | None = None,
    project_id: int | None = None,
    db: Session = Depends(get_db),
):
    return voucher_crud.list_vouchers(db, voucher_type=voucher_type, project_id=project_id)


@router.post("/", response_model=VoucherOut, status_code=status.HTTP_201_CREATED)
def create_voucher(voucher_in: VoucherCreate, db: Session = Depends(get_db)):
    return voucher_crud.create_voucher(db, voucher_in)


@router.get("/{voucher_id}", response_model=VoucherOut)
def get_voucher(voucher_id: int, db: Session = Depends(get_db)):
    db_voucher = voucher_crud.get_voucher(db, voucher_id)
    if not db_voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return db_voucher


@router.delete("/{voucher_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_voucher(voucher_id: int, db: Session = Depends(get_db)):
    db_voucher = voucher_crud.get_voucher(db, voucher_id)
    if not db_voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    delete_with_fk_guard(db, lambda: voucher_crud.delete_voucher(db, db_voucher), "voucher")
