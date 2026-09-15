from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import petty_cash as petty_cash_crud
from app.db.session import get_db
from app.schemas.petty_cash import (
    PettyCashExpenseCreate,
    PettyCashExpenseOut,
    PettyCashFloatCreate,
    PettyCashFloatOut,
    PettyCashFloatUpdate,
    PettyCashTopupCreate,
    PettyCashTopupOut,
)

router = APIRouter()


# Floats


@router.get("/floats", response_model=list[PettyCashFloatOut])
def list_floats(is_active: bool | None = None, db: Session = Depends(get_db)):
    return petty_cash_crud.list_floats(db, is_active=is_active)


@router.post("/floats", response_model=PettyCashFloatOut, status_code=status.HTTP_201_CREATED)
def create_float(float_in: PettyCashFloatCreate, db: Session = Depends(get_db)):
    try:
        return petty_cash_crud.create_float(db, float_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/floats/{float_id}", response_model=PettyCashFloatOut)
def update_float(float_id: int, float_in: PettyCashFloatUpdate, db: Session = Depends(get_db)):
    db_float = petty_cash_crud.get_float(db, float_id)
    if not db_float:
        raise HTTPException(status_code=404, detail="Float not found")
    return petty_cash_crud.update_float(db, db_float, float_in)


@router.delete("/floats/{float_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_float(float_id: int, db: Session = Depends(get_db)):
    db_float = petty_cash_crud.get_float(db, float_id)
    if not db_float:
        raise HTTPException(status_code=404, detail="Float not found")
    delete_with_fk_guard(db, lambda: petty_cash_crud.delete_float(db, db_float), "petty cash float")


# Top-ups


@router.get("/topups", response_model=list[PettyCashTopupOut])
def list_topups(float_id: int | None = None, db: Session = Depends(get_db)):
    return petty_cash_crud.list_topups(db, float_id=float_id)


@router.get("/topups/{topup_id}", response_model=PettyCashTopupOut)
def get_topup(topup_id: int, db: Session = Depends(get_db)):
    db_topup = petty_cash_crud.get_topup(db, topup_id)
    if not db_topup:
        raise HTTPException(status_code=404, detail="Top-up not found")
    return db_topup


@router.post("/topups", response_model=PettyCashTopupOut, status_code=status.HTTP_201_CREATED)
def create_topup(topup_in: PettyCashTopupCreate, db: Session = Depends(get_db)):
    try:
        return petty_cash_crud.create_topup(db, topup_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/topups/{topup_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topup(topup_id: int, db: Session = Depends(get_db)):
    db_topup = petty_cash_crud.get_topup(db, topup_id)
    if not db_topup:
        raise HTTPException(status_code=404, detail="Top-up not found")
    delete_with_fk_guard(db, lambda: petty_cash_crud.delete_topup(db, db_topup), "top-up")


# Expenses


@router.get("/expenses", response_model=list[PettyCashExpenseOut])
def list_expenses(
    float_id: int | None = None, project_id: int | None = None, db: Session = Depends(get_db)
):
    return petty_cash_crud.list_expenses(db, float_id=float_id, project_id=project_id)


@router.get("/expenses/{expense_id}", response_model=PettyCashExpenseOut)
def get_expense_detail(expense_id: int, db: Session = Depends(get_db)):
    db_expense = petty_cash_crud.get_expense(db, expense_id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return db_expense


@router.post("/expenses", response_model=PettyCashExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(expense_in: PettyCashExpenseCreate, db: Session = Depends(get_db)):
    try:
        return petty_cash_crud.create_expense(db, expense_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = petty_cash_crud.get_expense(db, expense_id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    delete_with_fk_guard(db, lambda: petty_cash_crud.delete_expense(db, db_expense), "expense")
