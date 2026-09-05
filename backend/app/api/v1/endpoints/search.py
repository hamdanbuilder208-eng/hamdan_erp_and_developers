from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.allottee import Allottee
from app.models.booking import Booking
from app.models.land_property import LandProperty
from app.models.project import Project
from app.models.unit import Unit
from app.models.user import User

router = APIRouter()

LIMIT_PER_CATEGORY = 5


class SearchResult(BaseModel):
    category: str
    id: int
    title: str
    subtitle: str | None = None
    url: str


def _allowed_modules(user: User) -> set[str] | None:
    """None means unrestricted (admin role)."""
    if user.role.is_admin:
        return None
    return {p.module_key for p in user.role.module_permissions}


@router.get("/", response_model=list[SearchResult])
def search(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = q.strip()
    if len(q) < 2:
        return []
    like = f"%{q}%"
    allowed = _allowed_modules(current_user)
    results: list[SearchResult] = []

    if allowed is None or "allottees" in allowed:
        for a in (
            db.query(Allottee)
            .filter(
                or_(
                    Allottee.name.ilike(like),
                    Allottee.mobile.ilike(like),
                    Allottee.cnic.ilike(like),
                    Allottee.allottee_code.ilike(like),
                )
            )
            .limit(LIMIT_PER_CATEGORY)
            .all()
        ):
            results.append(
                SearchResult(
                    category="Customer",
                    id=a.id,
                    title=a.name,
                    subtitle=a.mobile or a.allottee_code,
                    url="/customers",
                )
            )

    if allowed is None or "bookings" in allowed:
        for b in (
            db.query(Booking).filter(Booking.booking_ref_no.ilike(like)).limit(LIMIT_PER_CATEGORY).all()
        ):
            results.append(
                SearchResult(
                    category="Booking",
                    id=b.id,
                    title=b.booking_ref_no,
                    subtitle=b.allottee.name if b.allottee else None,
                    url="/bookings",
                )
            )

    if allowed is None or "projects" in allowed:
        for u in (
            db.query(Unit)
            .filter(or_(Unit.unit_number.ilike(like), Unit.unit_ref_no.ilike(like)))
            .limit(LIMIT_PER_CATEGORY)
            .all()
        ):
            results.append(
                SearchResult(
                    category="Unit",
                    id=u.id,
                    title=u.unit_number,
                    subtitle=u.unit_ref_no,
                    url=f"/projects/{u.project_id}",
                )
            )

        for p in (
            db.query(Project)
            .filter(or_(Project.project_name.ilike(like), Project.project_code.ilike(like)))
            .limit(LIMIT_PER_CATEGORY)
            .all()
        ):
            results.append(
                SearchResult(
                    category="Project",
                    id=p.id,
                    title=p.project_name,
                    subtitle=p.project_code,
                    url=f"/projects/{p.id}",
                )
            )

    if allowed is None or "land_properties" in allowed:
        for lp in (
            db.query(LandProperty)
            .filter(
                or_(
                    LandProperty.property_ref_no.ilike(like),
                    LandProperty.area_location.ilike(like),
                )
            )
            .limit(LIMIT_PER_CATEGORY)
            .all()
        ):
            results.append(
                SearchResult(
                    category="Land / Plot",
                    id=lp.id,
                    title=lp.property_ref_no,
                    subtitle=lp.area_location,
                    url="/land-plots",
                )
            )

    return results
