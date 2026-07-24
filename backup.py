#!/usr/bin/env python3
"""
Database backup for FinPerson.

- Postgres (DATABASE_URL set): runs pg_dump to a timestamped .sql file.
- SQLite (local dev): copies the .db file with a safe online backup.

Keeps the most recent N backups (default 14) and deletes older ones.

Run manually:
    python backup.py

Automate it on Render with a Cron Job service (see README):
    command: python backup.py
    schedule: 0 3 * * *          # 3am daily

NOTE: on Render, back up to external storage (S3, etc.) rather than the
service's ephemeral disk — the local filesystem does not persist across
deploys. This script writes locally; add an upload step for production.
"""

import os
import glob
import shutil
import sqlite3
import subprocess
import time
from datetime import datetime

BACKUP_DIR = os.environ.get("BACKUP_DIR", "backups")
KEEP = int(os.environ.get("BACKUP_KEEP", "14"))
DATABASE_URL = os.environ.get("DATABASE_URL", "")
SQLITE_PATH = os.environ.get("SQLITE_PATH", "finperson.db")


def ensure_dir():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def backup_postgres():
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    out = os.path.join(BACKUP_DIR, f"finperson-{stamp}.sql")
    url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    # pg_dump reads the connection string directly.
    subprocess.run(["pg_dump", "--no-owner", "--no-privileges", "-f", out, url], check=True)
    return out


def backup_sqlite():
    if not os.path.exists(SQLITE_PATH):
        print(f"no sqlite db at {SQLITE_PATH}, nothing to back up")
        return None
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    out = os.path.join(BACKUP_DIR, f"finperson-{stamp}.db")
    # Online backup API: safe even if the app is mid-write.
    src = sqlite3.connect(SQLITE_PATH)
    dst = sqlite3.connect(out)
    with dst:
        src.backup(dst)
    src.close()
    dst.close()
    return out


def rotate():
    files = sorted(glob.glob(os.path.join(BACKUP_DIR, "finperson-*")))
    for old in files[:-KEEP] if len(files) > KEEP else []:
        os.remove(old)
        print(f"removed old backup {old}")


def main():
    ensure_dir()
    is_pg = DATABASE_URL.startswith(("postgres://", "postgresql://"))
    out = backup_postgres() if is_pg else backup_sqlite()
    if out:
        size = os.path.getsize(out)
        print(f"backup written: {out} ({size} bytes)")
    rotate()


if __name__ == "__main__":
    main()
