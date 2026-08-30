from typing import Callable

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


def delete_with_fk_guard(db: Session, delete_fn: Callable[[], None], entity_name: str) -> None:
    """Runs a delete operation and converts a reference conflict into a clear
    400 error instead of letting a raw 500 reach the client. `delete_fn` may
    raise ValueError with a specific message (preferred, names the blocking
    records); any other DB-level foreign-key violation is caught as a
    fallback with a generic message."""
    try:
        delete_fn()
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"This {entity_name} is referenced by other records and cannot be deleted. "
            "Remove or reassign those records first.",
        )
