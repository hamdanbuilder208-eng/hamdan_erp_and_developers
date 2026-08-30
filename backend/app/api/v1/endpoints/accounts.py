from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.errors import delete_with_fk_guard
from app.crud import account as account_crud
from app.db.session import get_db
from app.models.account import AccountNature
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate, AccountWithBalance

router = APIRouter()


@router.get("/", response_model=list[AccountWithBalance])
def list_accounts(
    nature: AccountNature | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
):
    accounts = account_crud.list_accounts(db, nature=nature, is_active=is_active)
    result = []
    for acc in accounts:
        balance = account_crud.account_balance(db, acc.id)
        item = AccountWithBalance.model_validate(acc)
        item.balance = balance
        result.append(item)
    return result


@router.post("/", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(account_in: AccountCreate, db: Session = Depends(get_db)):
    return account_crud.create_account(db, account_in)


@router.put("/{account_id}", response_model=AccountOut)
def update_account(account_id: int, account_in: AccountUpdate, db: Session = Depends(get_db)):
    db_account = account_crud.get_account(db, account_id)
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account_crud.update_account(db, db_account, account_in)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(account_id: int, db: Session = Depends(get_db)):
    db_account = account_crud.get_account(db, account_id)
    if not db_account:
        raise HTTPException(status_code=404, detail="Account not found")
    delete_with_fk_guard(db, lambda: account_crud.delete_account(db, db_account), "account")
