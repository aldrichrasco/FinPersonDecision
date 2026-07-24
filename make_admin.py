#!/usr/bin/env python3
"""
Promote a user to admin (there's no self-serve admin signup, by design).

Usage:
    python make_admin.py someone@example.com

The user must have signed up first (Google or email). Run this against the
same DATABASE_URL / SQLITE_PATH your server uses.
"""

import sys
import db


def main():
    if len(sys.argv) != 2:
        print("usage: python make_admin.py <email>")
        sys.exit(1)
    email = sys.argv[1].strip().lower()
    user = db.get_user_by_email(email)
    if not user:
        print(f"no user found with email {email!r} — have they signed up yet?")
        sys.exit(1)
    with db._conn() as conn:
        cur = conn.cursor()
        cur.execute(f"UPDATE users SET is_admin = 1 WHERE id = {db._ph(1)}", (user["id"],))
    print(f"{email} is now an admin. Visit /admin.html while signed in as them.")


if __name__ == "__main__":
    db.init_db()
    main()
