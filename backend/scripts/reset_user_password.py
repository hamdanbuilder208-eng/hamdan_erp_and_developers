"""Set a new password for an ERP staff user (e.g. a forgotten admin password).

The new password is typed at a hidden prompt, never passed on the command line.

Usage (from the backend folder):
    venv\\Scripts\\python.exe scripts\\reset_user_password.py --url "mysql://..." --username admin
"""

import argparse
import getpass
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.security import hash_password  # noqa: E402


def to_sqlalchemy_url(url: str) -> str:
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url[len("mysql://"):]
    return url


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="Database URL (Railway tunnel URL)")
    parser.add_argument("--username", default="admin")
    args = parser.parse_args()

    engine = create_engine(to_sqlalchemy_url(args.url))
    with engine.connect() as conn:
        user = conn.execute(
            text("SELECT id, full_name, is_active FROM users WHERE username = :u"), {"u": args.username}
        ).first()
    if not user:
        sys.exit(f"No user named '{args.username}' found.")

    print(f"Resetting password for '{args.username}' ({user.full_name}).")
    new_password = getpass.getpass("New password (hidden): ")
    if len(new_password) < 6:
        sys.exit("Password must be at least 6 characters. Nothing changed.")
    if getpass.getpass("Type it again: ") != new_password:
        sys.exit("The two passwords do not match. Nothing changed.")

    with engine.begin() as conn:
        conn.execute(
            text("UPDATE users SET hashed_password = :h, is_active = 1 WHERE id = :id"),
            {"h": hash_password(new_password), "id": user.id},
        )
    print("Done. Log in with the new password.")


if __name__ == "__main__":
    main()
