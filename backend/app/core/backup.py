import os
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings


def create_backup_file() -> Path:
    """Dumps the live database via mysqldump into a timestamped .sql file in a
    scratch temp directory and returns its path. Caller is responsible for
    deleting it once served."""
    parsed = urlparse(settings.DATABASE_URL.replace("mysql+pymysql://", "mysql://"))
    host = parsed.hostname or "localhost"
    port = parsed.port or 3306
    user = parsed.username or "root"
    password = parsed.password or ""
    db_name = parsed.path.lstrip("/")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = Path(tempfile.gettempdir()) / f"hamdan_erp_backup_{timestamp}.sql"

    env = os.environ.copy()
    if password:
        env["MYSQL_PWD"] = password

    with open(out_path, "wb") as out_file:
        result = subprocess.run(
            [settings.MYSQLDUMP_PATH, "-h", host, "-P", str(port), "-u", user, db_name],
            stdout=out_file,
            stderr=subprocess.PIPE,
            env=env,
        )

    if result.returncode != 0:
        out_path.unlink(missing_ok=True)
        raise RuntimeError(
            f"mysqldump failed (exit {result.returncode}): {result.stderr.decode(errors='replace')}"
        )

    return out_path
