from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import expense as expense_crud
from app.db.session import get_db
from app.schemas.expense import (
    EmployeeCreate,
    EmployeeOut,
    EmployeeUpdate,
    OfficeExpenseCreate,
    OfficeExpenseOut,
    OwnerPersonalExpenseCreate,
    OwnerPersonalExpenseOut,
    WagePaymentCreate,
    WagePaymentOut,
)

router = APIRouter()


# Office Expenses


@router.get("/office", response_model=list[OfficeExpenseOut])
def list_office_expenses(project_id: int | None = None, db: Session = Depends(get_db)):
    return expense_crud.list_office_expenses(db, project_id=project_id)


@router.post("/office", response_model=OfficeExpenseOut, status_code=status.HTTP_201_CREATED)
def create_office_expense(expense_in: OfficeExpenseCreate, db: Session = Depends(get_db)):
    try:
        return expense_crud.create_office_expense(db, expense_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/office/{expense_id}", response_model=OfficeExpenseOut)
def get_office_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = expense_crud.get_office_expense(db, expense_id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return db_expense


@router.delete("/office/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_office_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = expense_crud.get_office_expense(db, expense_id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    delete_with_fk_guard(db, lambda: expense_crud.delete_office_expense(db, db_expense), "expense")


# Employees


@router.get("/employees", response_model=list[EmployeeOut])
def list_employees(is_active: bool | None = None, db: Session = Depends(get_db)):
    return expense_crud.list_employees(db, is_active=is_active)


@router.post("/employees", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
def create_employee(employee_in: EmployeeCreate, db: Session = Depends(get_db)):
    return expense_crud.create_employee(db, employee_in)


@router.put("/employees/{employee_id}", response_model=EmployeeOut)
def update_employee(employee_id: int, employee_in: EmployeeUpdate, db: Session = Depends(get_db)):
    db_employee = expense_crud.get_employee(db, employee_id)
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return expense_crud.update_employee(db, db_employee, employee_in)


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    db_employee = expense_crud.get_employee(db, employee_id)
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    delete_with_fk_guard(db, lambda: expense_crud.delete_employee(db, db_employee), "employee")


# Wage Payments


@router.get("/wages", response_model=list[WagePaymentOut])
def list_wage_payments(employee_id: int | None = None, db: Session = Depends(get_db)):
    return expense_crud.list_wage_payments(db, employee_id=employee_id)


@router.post("/wages", response_model=WagePaymentOut, status_code=status.HTTP_201_CREATED)
def create_wage_payment(payment_in: WagePaymentCreate, db: Session = Depends(get_db)):
    try:
        return expense_crud.create_wage_payment(db, payment_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/wages/{payment_id}", response_model=WagePaymentOut)
def get_wage_payment(payment_id: int, db: Session = Depends(get_db)):
    db_payment = expense_crud.get_wage_payment(db, payment_id)
    if not db_payment:
        raise HTTPException(status_code=404, detail="Wage payment not found")
    return db_payment


@router.delete("/wages/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wage_payment(payment_id: int, db: Session = Depends(get_db)):
    db_payment = expense_crud.get_wage_payment(db, payment_id)
    if not db_payment:
        raise HTTPException(status_code=404, detail="Wage payment not found")
    delete_with_fk_guard(db, lambda: expense_crud.delete_wage_payment(db, db_payment), "wage payment")


# Owner Personal Expenses


@router.get("/owner-personal", response_model=list[OwnerPersonalExpenseOut])
def list_owner_expenses(db: Session = Depends(get_db)):
    return expense_crud.list_owner_expenses(db)


@router.post("/owner-personal", response_model=OwnerPersonalExpenseOut, status_code=status.HTTP_201_CREATED)
def create_owner_expense(expense_in: OwnerPersonalExpenseCreate, db: Session = Depends(get_db)):
    try:
        return expense_crud.create_owner_expense(db, expense_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/owner-personal/{expense_id}", response_model=OwnerPersonalExpenseOut)
def get_owner_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = expense_crud.get_owner_expense(db, expense_id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return db_expense


@router.delete("/owner-personal/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_owner_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = expense_crud.get_owner_expense(db, expense_id)
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    delete_with_fk_guard(db, lambda: expense_crud.delete_owner_expense(db, db_expense), "expense")
