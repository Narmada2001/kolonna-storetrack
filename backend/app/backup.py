"""Creates a timestamped dump of the database and prunes old backups.

Supports whatever DATABASE_URL is configured (SQLite, MySQL, or PostgreSQL) so
it works the same way in local dev (SQLite) as it does against a real server.

Usage:
    python -m app.backup            # create a backup now
    python -m app.backup --list     # list existing backups

Meant to be run on a schedule (cron / Windows Task Scheduler — see SETUP.md
for an example) so backups happen automatically and regularly. Admins can
also trigger one on demand from the Reports page, which calls create_backup()
via POST /admin/backups (see routers/admin.py).
"""
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy.engine import make_url

from .config import settings

BACKUP_DIR = Path(__file__).resolve().parent.parent / "backups"
KEEP_LAST = 14  # rotation: only the most recent N backups are kept


class BackupError(Exception):
    """Raised when a backup can't be created (missing DB client tools, etc.)."""


def _dump_mysql(url, out_path: Path) -> None:
    if not shutil.which("mysqldump"):
        raise BackupError(
            "mysqldump was not found on PATH. Install the MySQL client tools to enable backups."
        )
    cmd = [
        "mysqldump",
        f"--host={url.host or 'localhost'}",
        f"--port={url.port or 3306}",
        f"--user={url.username}",
        f"--result-file={out_path}",
        url.database,
    ]
    env = os.environ.copy()
    env["MYSQL_PWD"] = url.password or ""
    subprocess.run(cmd, check=True, env=env)


def _dump_postgres(url, out_path: Path) -> None:
    if not shutil.which("pg_dump"):
        raise BackupError(
            "pg_dump was not found on PATH. Install the PostgreSQL client tools to enable backups."
        )
    cmd = [
        "pg_dump",
        f"--host={url.host or 'localhost'}",
        f"--port={url.port or 5432}",
        f"--username={url.username}",
        f"--file={out_path}",
        url.database,
    ]
    env = os.environ.copy()
    env["PGPASSWORD"] = url.password or ""
    subprocess.run(cmd, check=True, env=env)


def _dump_sqlite(url, out_path: Path) -> Path:
    db_file = Path(url.database)
    if not db_file.exists():
        raise BackupError(f"SQLite database file not found: {db_file}")
    sqlite_out = out_path.with_suffix(".sqlite3")
    shutil.copy(db_file, sqlite_out)
    return sqlite_out


def create_backup() -> Path:
    """Dump the configured database to a timestamped file and prune old backups."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    url = make_url(settings.database_url)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_path = BACKUP_DIR / f"storetrack_{timestamp}.sql"

    if url.drivername.startswith("mysql"):
        _dump_mysql(url, out_path)
    elif url.drivername.startswith("postgresql"):
        _dump_postgres(url, out_path)
    elif url.drivername.startswith("sqlite"):
        out_path = _dump_sqlite(url, out_path)
    else:
        raise BackupError(f"Unsupported database driver for backup: {url.drivername}")

    _prune_old_backups()
    return out_path


def _prune_old_backups() -> None:
    backups = sorted(BACKUP_DIR.glob("storetrack_*"), key=lambda p: p.stat().st_mtime, reverse=True)
    for stale in backups[KEEP_LAST:]:
        stale.unlink(missing_ok=True)


def list_backups() -> list[dict]:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    backups = sorted(BACKUP_DIR.glob("storetrack_*"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        {
            "filename": p.name,
            "size_bytes": p.stat().st_size,
            "created_at": datetime.utcfromtimestamp(p.stat().st_mtime),
        }
        for p in backups
    ]


if __name__ == "__main__":
    if "--list" in sys.argv:
        rows = list_backups()
        if not rows:
            print("No backups yet.")
        for row in rows:
            print(f"{row['created_at']}  {row['filename']}  ({row['size_bytes']} bytes)")
    else:
        created = create_backup()
        print(f"Backup created: {created}")
