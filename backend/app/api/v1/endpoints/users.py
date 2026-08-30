from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin_user
from app.core.errors import delete_with_fk_guard
from app.core.modules import MODULE_KEYS
from app.crud import user as user_crud
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    ModuleInfo,
    RoleCreate,
    RoleOut,
    RoleUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
)

router = APIRouter()


@router.get("/", response_model=list[UserOut], dependencies=[Depends(get_current_admin_user)])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return user_crud.list_users(db, skip=skip, limit=limit)


@router.post(
    "/",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin_user)],
)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    if user_crud.get_user_by_username(db, user_in.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    return user_crud.create_user(db, user_in)


@router.put(
    "/{user_id}",
    response_model=UserOut,
    dependencies=[Depends(get_current_admin_user)],
)
def update_user(user_id: int, user_in: UserUpdate, db: Session = Depends(get_db)):
    db_user = user_crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_crud.update_user(db, db_user, user_in)


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account.")
    db_user = user_crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    delete_with_fk_guard(db, lambda: user_crud.delete_user(db, db_user), "user")


@router.get(
    "/roles",
    response_model=list[RoleOut],
    dependencies=[Depends(get_current_admin_user)],
)
def list_roles(db: Session = Depends(get_db)):
    return user_crud.list_roles(db)


@router.post(
    "/roles",
    response_model=RoleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(get_current_admin_user)],
)
def create_role(role_in: RoleCreate, db: Session = Depends(get_db)):
    if user_crud.get_role_by_name(db, role_in.name):
        raise HTTPException(status_code=400, detail="Role already exists")
    return user_crud.create_role(db, role_in)


@router.put(
    "/roles/{role_id}",
    response_model=RoleOut,
    dependencies=[Depends(get_current_admin_user)],
)
def update_role(role_id: int, role_in: RoleUpdate, db: Session = Depends(get_db)):
    db_role = user_crud.get_role(db, role_id)
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    return user_crud.update_role(db, db_role, role_in)


@router.delete(
    "/roles/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(get_current_admin_user)],
)
def delete_role(role_id: int, db: Session = Depends(get_db)):
    db_role = user_crud.get_role(db, role_id)
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    delete_with_fk_guard(db, lambda: user_crud.delete_role(db, db_role), "role")


@router.get(
    "/modules",
    response_model=list[ModuleInfo],
    dependencies=[Depends(get_current_admin_user)],
)
def list_modules():
    return [ModuleInfo(key=key, label=label) for key, label in MODULE_KEYS.items()]
