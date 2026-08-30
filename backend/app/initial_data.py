"""Seeds the database with a default Admin role and Admin user.

Run once after migrations: python -m app.initial_data
"""

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.account import Account, AccountNature
from app.models.user import Role, User

_DEFAULT_COA = [
    # (code, name, nature, is_control, children)
    ("1000", "Assets", AccountNature.ASSET, True, [
        ("1010", "Cash in Hand", AccountNature.ASSET, False, []),
        ("1020", "Bank Accounts", AccountNature.ASSET, False, []),
        ("1030", "Accounts Receivable", AccountNature.ASSET, False, []),
        ("1040", "Material / Inventory Stock", AccountNature.ASSET, False, []),
    ]),
    ("2000", "Liabilities", AccountNature.LIABILITY, True, [
        ("2010", "Accounts Payable", AccountNature.LIABILITY, False, []),
        ("2020", "Broker Commission Payable", AccountNature.LIABILITY, False, []),
    ]),
    ("3000", "Capital", AccountNature.CAPITAL, True, [
        ("3010", "Owner's Capital", AccountNature.CAPITAL, False, []),
        ("3020", "Partner Equity", AccountNature.CAPITAL, False, []),
    ]),
    ("4000", "Revenue", AccountNature.REVENUE, True, [
        ("4010", "Unit Sales", AccountNature.REVENUE, False, []),
        ("4020", "Plot / Land Sales", AccountNature.REVENUE, False, []),
    ]),
    ("5000", "Expenses", AccountNature.EXPENSE, True, [
        ("5010", "Office Expenses", AccountNature.EXPENSE, False, []),
        ("5020", "Wages", AccountNature.EXPENSE, False, []),
        ("5030", "Owner's Personal Expenses", AccountNature.EXPENSE, False, []),
        ("5050", "Material Consumption", AccountNature.EXPENSE, False, []),
    ]),
]


def _seed_accounts(db) -> None:
    if db.query(Account).count() > 0:
        print("Chart of accounts already seeded")
        return

    for code, name, nature, is_control, children in _DEFAULT_COA:
        parent = Account(code=code, name=name, nature=nature, is_control=is_control)
        db.add(parent)
        db.flush()
        for c_code, c_name, c_nature, c_is_control, _ in children:
            db.add(
                Account(
                    code=c_code,
                    name=c_name,
                    nature=c_nature,
                    is_control=c_is_control,
                    parent_id=parent.id,
                )
            )
    db.commit()
    print("Seeded default chart of accounts")


def seed() -> None:
    db = SessionLocal()
    try:
        admin_role = db.query(Role).filter(Role.name == "Admin").first()
        if not admin_role:
            admin_role = Role(name="Admin", description="Full system access", is_admin=True)
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)
            print("Created Admin role")

        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@hamdanassociates.com",
                full_name="Mr. Hamdan",
                hashed_password=hash_password("Admin@123"),
                is_active=True,
                role_id=admin_role.id,
            )
            db.add(admin_user)
            db.commit()
            print("Created admin user -> username: admin | password: Admin@123")
        else:
            print("Admin user already exists")

        _seed_accounts(db)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
