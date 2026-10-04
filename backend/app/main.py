from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.petty_cash_guard import InsufficientPettyCash

app = FastAPI(title=settings.PROJECT_NAME)

# Locally uploaded files (customer/nominee photos, etc). On a real deployment
# this directory isn't persistent — swap this mount for an S3 bucket (or an
# attached persistent volume) before/while deploying.
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    # Also accept the same frontend dev server reached over the local network
    # (e.g. a phone on the same WiFi scanning a QR code) — any private-range IP
    # on port 5173, in addition to the explicit origins above.
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# A payment that would overdraw a petty cash float can come from any form —
# surface it as a clear 400 even where the endpoint doesn't catch ValueError.
@app.exception_handler(InsufficientPettyCash)
def insufficient_petty_cash_handler(request: Request, exc: InsufficientPettyCash):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/")
def root():
    return {"name": settings.PROJECT_NAME, "status": "running"}
