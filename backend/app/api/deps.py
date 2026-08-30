from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.crud.customer_account import get_by_id as get_customer_account_by_id
from app.crud.user import get_user_by_username
from app.db.session import get_db
from app.models.customer_account import CustomerAccount
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
portal_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/portal/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        username: str | None = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = get_user_by_username(db, username)
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.role.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    return current_user


def require_module_access(module_key: str):
    """Factory: each router mount passes its own module key (see api/v1/api.py).
    An is_admin role always bypasses this — module grants only matter for
    non-admin roles."""

    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.is_admin:
            return current_user
        allowed = {p.module_key for p in current_user.role.module_permissions}
        if module_key not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions for this module",
            )
        return current_user

    return _dependency


def get_current_customer(
    token: str = Depends(portal_oauth2_scheme), db: Session = Depends(get_db)
) -> CustomerAccount:
    """Customer-portal counterpart to get_current_user. Customer tokens encode their
    subject as "customer:<id>" (see core/security.create_access_token callers in
    crud/customer_account.py) precisely so a staff token can never satisfy this
    dependency, and a customer token can never satisfy get_current_user above —
    even though both share the same JWT signing secret."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        subject: str | None = payload.get("sub")
        if not subject or not subject.startswith("customer:"):
            raise credentials_exception
        account_id = int(subject.removeprefix("customer:"))
    except (JWTError, ValueError):
        raise credentials_exception

    account = get_customer_account_by_id(db, account_id)
    if account is None or not account.is_active:
        raise credentials_exception
    return account
