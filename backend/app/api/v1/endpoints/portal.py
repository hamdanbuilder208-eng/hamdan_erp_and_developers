from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_customer
from app.core.security import create_access_token
from app.crud import booking as booking_crud
from app.crud import company_settings as company_settings_crud
from app.crud import customer_account as customer_account_crud
from app.db.session import get_db
from app.models.booking import Booking
from app.models.customer_account import CustomerAccount
from app.models.receipt import Receipt
from app.models.refund import Refund, RefundType
from app.schemas.booking import BookingOut
from app.schemas.company_settings import CompanySettingsOut
from app.schemas.customer_account import (
    CustomerAccountOut,
    CustomerChangePassword,
    CustomerForgotPassword,
    CustomerSignup,
)
from app.schemas.receipt import ReceiptWithBookingOut
from app.schemas.refund import RefundOut
from app.schemas.token import Token


def _my_receipts_query(db: Session, allottee_id: int):
    return (
        db.query(Receipt)
        .join(Booking, Receipt.booking_id == Booking.id)
        .options(
            joinedload(Receipt.credit_account),
            joinedload(Receipt.booking).joinedload(Booking.unit),
            joinedload(Receipt.booking).joinedload(Booking.project),
            joinedload(Receipt.booking).joinedload(Booking.allottee),
            joinedload(Receipt.booking).joinedload(Booking.schedule_lines),
            joinedload(Receipt.booking).joinedload(Booking.booking_agent),
        )
        .filter(Booking.allottee_id == allottee_id)
    )

router = APIRouter()


@router.post("/signup", response_model=CustomerAccountOut, status_code=status.HTTP_201_CREATED)
def signup(signup_in: CustomerSignup, db: Session = Depends(get_db)):
    try:
        return customer_account_crud.signup(db, signup_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    account = customer_account_crud.authenticate(db, form_data.username, form_data.password)
    if not account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect mobile number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # "customer:" prefix is what get_current_customer requires — see deps.py.
    access_token = create_access_token(subject=f"customer:{account.id}")
    return Token(access_token=access_token)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(reset_in: CustomerForgotPassword, db: Session = Depends(get_db)):
    try:
        customer_account_crud.reset_password(db, reset_in)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/me", response_model=CustomerAccountOut)
def read_me(current_customer: CustomerAccount = Depends(get_current_customer)):
    return current_customer


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    change_in: CustomerChangePassword,
    current_customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    try:
        customer_account_crud.change_password(
            db, current_customer, change_in.current_password, change_in.new_password
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/me/bookings", response_model=list[BookingOut])
def my_bookings(
    current_customer: CustomerAccount = Depends(get_current_customer), db: Session = Depends(get_db)
):
    return booking_crud.list_bookings(db, allottee_id=current_customer.allottee_id)


@router.get("/me/receipts", response_model=list[ReceiptWithBookingOut])
def my_receipts(
    current_customer: CustomerAccount = Depends(get_current_customer), db: Session = Depends(get_db)
):
    return (
        _my_receipts_query(db, current_customer.allottee_id).order_by(Receipt.id.desc()).all()
    )


@router.get("/me/receipts/{receipt_id}", response_model=ReceiptWithBookingOut)
def my_receipt(
    receipt_id: int,
    current_customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    receipt = (
        _my_receipts_query(db, current_customer.allottee_id)
        .filter(Receipt.id == receipt_id)
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


@router.get("/company-settings", response_model=CompanySettingsOut)
def company_settings(
    current_customer: CustomerAccount = Depends(get_current_customer), db: Session = Depends(get_db)
):
    """Lets receipt print pages show the same configured accountant signature the
    staff side uses (Admin Utilities > Signature Setup), without requiring a
    customer token to pass the staff-only get_current_user check on /admin/settings."""
    return company_settings_crud.get_settings(db)


@router.get("/me/refunds", response_model=list[RefundOut])
def my_refunds(
    current_customer: CustomerAccount = Depends(get_current_customer), db: Session = Depends(get_db)
):
    return (
        db.query(Refund)
        .join(Booking, Refund.booking_id == Booking.id)
        .options(
            joinedload(Refund.account),
            joinedload(Refund.cash_account),
            joinedload(Refund.booking).joinedload(Booking.unit),
            joinedload(Refund.booking).joinedload(Booking.project),
            joinedload(Refund.booking).joinedload(Booking.allottee),
            joinedload(Refund.booking).joinedload(Booking.schedule_lines),
            joinedload(Refund.booking).joinedload(Booking.booking_agent),
        )
        .filter(Refund.refund_type == RefundType.CUSTOMER, Booking.allottee_id == current_customer.allottee_id)
        .order_by(Refund.id.desc())
        .all()
    )
