from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import partner_expense as expense_crud
from app.db.session import get_db
from app.schemas.partner import PartnerExpenseCreate, PartnerExpenseOut

router = APIRouter()


@router.get("/", response_model=list[PartnerExpenseOut])
def list_expenses(
    partner_id: int | None = None,
    project_id: int | None = None,
    db: Session = Depends(get_db),
):
    return expense_crud.list_expenses(db, partner_id=partner_id, project_id=project_id)


@router.post("/", response_model=PartnerExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(expense_in: PartnerExpenseCreate, db: Session = Depends(get_db)):
    try:
        return expense_crud.create_expense(db, expense_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = expense_crud.get_expense(db, expense_id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    expense_crud.delete_expense(db, db_expense)
