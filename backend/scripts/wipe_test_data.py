"""Wipe all test data from an ERP database for a fresh start.

Keeps: users, roles, role permissions, company settings, the default chart of
accounts and the migration version. Everything else (projects, units,
customers, bookings, receipts, expenses, vendors, stock, partners, ...) is
emptied and id numbering restarts from 1.

A JSON backup of every table is written first, in backend/backups/.

Usage (from the backend folder):
    venv\\Scripts\\python.exe scripts\\wipe_test_data.py --url "mysql://..."            # preview only
    venv\\Scripts\\python.exe scripts\\wipe_test_data.py --url "mysql://..." --confirm  # really delete
"""

import argparse
import datetime as dt
import decimal
import json
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.initial_data import _DEFAULT_COA  # noqa: E402

KEEP_TABLES = {
    "alembic_version",
    "users",
    "roles",
    "role_module_permissions",
    "company_settings",
    "accounts",  # trimmed to the default chart below, not emptied
}


def default_account_codes() -> set[str]:
    codes = set()
    for code, _, _, _, children in _DEFAULT_COA:
        codes.add(code)
        codes.update(c[0] for c in children)
    return codes


def to_sqlalchemy_url(url: str) -> str:
    if url.startswith("mysql://"):
        return "mysql+pymysql://" + url[len("mysql://"):]
    return url


def json_default(value):
    if isinstance(value, (dt.date, dt.datetime, dt.time)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return str(value)
    if isinstance(value, bytes):
        return value.hex()
    return str(value)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True, help="Database URL (Railway MYSQL_PUBLIC_URL)")
    parser.add_argument("--confirm", action="store_true", help="Actually delete (otherwise preview only)")
    args = parser.parse_args()

    engine = create_engine(to_sqlalchemy_url(args.url))
    tables = sorted(inspect(engine).get_table_names())
    code_list = ",".join(f"'{c}'" for c in sorted(default_account_codes()))

    with engine.connect() as conn:
        db_name = conn.execute(text("SELECT DATABASE()")).scalar()
        counts = {t: conn.execute(text(f"SELECT COUNT(*) FROM `{t}`")).scalar() for t in tables}
        extra_accounts = 0
        if "accounts" in tables:
            extra_accounts = conn.execute(
                text(f"SELECT COUNT(*) FROM accounts WHERE code NOT IN ({code_list})")
            ).scalar()

    print(f"Database: {db_name}")
    print("\nWill be EMPTIED:")
    for t in tables:
        if t not in KEEP_TABLES and counts[t]:
            print(f"  {t}: {counts[t]} rows")
    print(f"  accounts (non-default, e.g. banks/petty cash holders): {extra_accounts} rows")
    print("\nWill be KEPT:")
    for t in sorted(KEEP_TABLES & set(tables)):
        print(f"  {t}: {counts[t]} rows")

    if not args.confirm:
        print("\nPreview only. Nothing deleted. Run again with --confirm to delete.")
        return

    backup_dir = Path(__file__).resolve().parents[1] / "backups"
    backup_dir.mkdir(exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = backup_dir / f"{db_name}_before_wipe_{stamp}.json"
    with engine.connect() as conn:
        dump = {t: [dict(r._mapping) for r in conn.execute(text(f"SELECT * FROM `{t}`"))] for t in tables}
    backup_file.write_text(json.dumps(dump, default=json_default, indent=1), encoding="utf-8")
    print(f"\nBackup saved: {backup_file}")

    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        try:
            for t in tables:
                if t not in KEEP_TABLES:
                    conn.execute(text(f"DELETE FROM `{t}`"))
                    conn.execute(text(f"ALTER TABLE `{t}` AUTO_INCREMENT = 1"))
            if "accounts" in tables:
                conn.execute(text(f"DELETE FROM accounts WHERE code NOT IN ({code_list})"))
        finally:
            conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))

    print("Done. All test data deleted; logins, roles, settings and default accounts kept.")


if __name__ == "__main__":
    main()
