import pytest
from sqlalchemy.orm import Session

from app.crud import customer_account as customer_account_crud
from app.models.allottee import Allottee
from app.schemas.customer_account import CustomerForgotPassword, CustomerSignup


@pytest.fixture()
def allottee_with_cnic(db: Session) -> Allottee:
    obj = Allottee(allottee_code="ALT-100", name="Ali Khan", mobile="03001234567", cnic="3520112345671")
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def test_signup_matches_by_mobile_and_cnic(db: Session, allottee_with_cnic):
    account = customer_account_crud.signup(
        db,
        CustomerSignup(mobile="03001234567", cnic="3520112345671", password="mypassword"),
    )

    assert account.username == "03001234567"
    assert account.allottee_id == allottee_with_cnic.id
    assert customer_account_crud.authenticate(db, "03001234567", "mypassword") is not None


def test_signup_rejects_unmatched_identity(db: Session, allottee_with_cnic):
    with pytest.raises(ValueError, match="No matching customer record"):
        customer_account_crud.signup(
            db,
            CustomerSignup(mobile="03001234567", cnic="0000000000000", password="mypassword"),
        )


def test_signup_rejects_duplicate_account(db: Session, allottee_with_cnic):
    customer_account_crud.signup(
        db, CustomerSignup(mobile="03001234567", cnic="3520112345671", password="mypassword")
    )

    with pytest.raises(ValueError, match="already exists"):
        customer_account_crud.signup(
            db, CustomerSignup(mobile="03001234567", cnic="3520112345671", password="another")
        )


def test_authenticate_rejects_wrong_password(db: Session, allottee_with_cnic):
    customer_account_crud.signup(
        db, CustomerSignup(mobile="03001234567", cnic="3520112345671", password="mypassword")
    )

    assert customer_account_crud.authenticate(db, "03001234567", "wrongpass") is None


def test_change_password_requires_current_password(db: Session, allottee_with_cnic):
    account = customer_account_crud.signup(
        db, CustomerSignup(mobile="03001234567", cnic="3520112345671", password="mypassword")
    )

    with pytest.raises(ValueError, match="incorrect"):
        customer_account_crud.change_password(db, account, "wrongcurrent", "newpassword")

    customer_account_crud.change_password(db, account, "mypassword", "newpassword")
    assert customer_account_crud.authenticate(db, "03001234567", "newpassword") is not None


def test_forgot_password_reproves_identity_before_resetting(db: Session, allottee_with_cnic):
    customer_account_crud.signup(
        db, CustomerSignup(mobile="03001234567", cnic="3520112345671", password="mypassword")
    )

    with pytest.raises(ValueError, match="No matching customer record"):
        customer_account_crud.reset_password(
            db,
            CustomerForgotPassword(mobile="03001234567", cnic="wrong-cnic", new_password="resetpass"),
        )

    customer_account_crud.reset_password(
        db,
        CustomerForgotPassword(mobile="03001234567", cnic="3520112345671", new_password="resetpass"),
    )
    assert customer_account_crud.authenticate(db, "03001234567", "resetpass") is not None
