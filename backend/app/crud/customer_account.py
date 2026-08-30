from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password, verify_password
from app.models.allottee import Allottee
from app.models.customer_account import CustomerAccount
from app.schemas.customer_account import CustomerForgotPassword, CustomerSignup


def get_by_id(db: Session, account_id: int) -> CustomerAccount | None:
    return (
        db.query(CustomerAccount)
        .options(joinedload(CustomerAccount.allottee))
        .filter(CustomerAccount.id == account_id)
        .first()
    )


def get_by_username(db: Session, username: str) -> CustomerAccount | None:
    return (
        db.query(CustomerAccount)
        .options(joinedload(CustomerAccount.allottee))
        .filter(CustomerAccount.username == username)
        .first()
    )


def authenticate(db: Session, username: str, password: str) -> CustomerAccount | None:
    account = get_by_username(db, username)
    if not account or not verify_password(password, account.hashed_password):
        return None
    return account


def signup(db: Session, signup_in: CustomerSignup) -> CustomerAccount:
    allottee = (
        db.query(Allottee)
        .filter(Allottee.mobile == signup_in.mobile, Allottee.cnic == signup_in.cnic)
        .first()
    )
    if not allottee:
        raise ValueError("No matching customer record found — contact your sales office")

    existing = db.query(CustomerAccount).filter(CustomerAccount.allottee_id == allottee.id).first()
    if existing:
        raise ValueError("An account already exists for this number — please log in")

    if db.query(CustomerAccount).filter(CustomerAccount.username == signup_in.mobile).first():
        raise ValueError("An account already exists for this number — please log in")

    account = CustomerAccount(
        allottee_id=allottee.id,
        username=signup_in.mobile,
        hashed_password=hash_password(signup_in.password),
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return get_by_id(db, account.id)


def change_password(db: Session, account: CustomerAccount, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, account.hashed_password):
        raise ValueError("Current password is incorrect")
    account.hashed_password = hash_password(new_password)
    db.commit()


def reset_password(db: Session, reset_in: CustomerForgotPassword) -> None:
    """Forgot-password flow: re-proves identity the same way signup does (mobile +
    CNIC matching the Allottee on file), then sets a new password directly — no
    email/SMS step, since Twilio isn't wired up for the portal yet and this keeps
    the same trust model already used for signup."""
    allottee = (
        db.query(Allottee)
        .filter(Allottee.mobile == reset_in.mobile, Allottee.cnic == reset_in.cnic)
        .first()
    )
    if not allottee:
        raise ValueError("No matching customer record found — contact your sales office")

    account = db.query(CustomerAccount).filter(CustomerAccount.allottee_id == allottee.id).first()
    if not account:
        raise ValueError("No account found for this number — please sign up first")

    account.hashed_password = hash_password(reset_in.new_password)
    db.commit()
