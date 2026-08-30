from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.api.deps import get_current_admin_user
from app.core.backup import create_backup_file
from app.crud import company_settings as settings_crud
from app.crud import data_integrity as integrity_crud
from app.db.session import get_db
from app.schemas.company_settings import CompanySettingsOut, CompanySettingsUpdate
from app.schemas.data_integrity import DataIntegrityReport

router = APIRouter()


@router.get("/settings", response_model=CompanySettingsOut)
def get_settings(db: Session = Depends(get_db)):
    """Readable by any logged-in user — the accountant signature block is shown on
    every print page, not just to admins. Only editing (below) is admin-gated."""
    return settings_crud.get_settings(db)


@router.put(
    "/settings",
    response_model=CompanySettingsOut,
    dependencies=[Depends(get_current_admin_user)],
)
def update_settings(settings_in: CompanySettingsUpdate, db: Session = Depends(get_db)):
    return settings_crud.update_settings(db, settings_in)


@router.get("/backup", dependencies=[Depends(get_current_admin_user)])
def download_backup():
    try:
        backup_path = create_backup_file()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return FileResponse(
        backup_path,
        media_type="application/sql",
        filename=backup_path.name,
        background=BackgroundTask(backup_path.unlink, missing_ok=True),
    )


@router.get(
    "/data-integrity",
    response_model=DataIntegrityReport,
    dependencies=[Depends(get_current_admin_user)],
)
def data_integrity(db: Session = Depends(get_db)):
    results = integrity_crud.run_checks(db)
    return DataIntegrityReport(results=results, all_ok=all(r.ok for r in results))
