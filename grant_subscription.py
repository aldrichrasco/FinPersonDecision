#!/usr/bin/env python3
"""
Grant a complimentary FinPerson Pro subscription (there's no self-serve way
to do this outside Stripe checkout, by design).

Usage:
    python grant_subscription.py someone@example.com

Writes a row to `subscriptions` with provider="manual" and status="active",
so subscription_active() in server.py treats it exactly like a real Stripe
subscription — same gate as /api/turtle/session and /api/chat/<slug>.
provider="manual" (not "stripe") keeps it clearly distinguishable from a
real payment if you ever look at the table directly.

The user must have signed up first (Google or email). Run this against the
same DATABASE_URL / SQLITE_PATH your server uses.
"""

import sys
import db


def main():
    if len(sys.argv) != 2:
        print("usage: python grant_subscription.py <email>")
        sys.exit(1)
    email = sys.argv[1].strip().lower()
    user = db.get_user_by_email(email)
    if not user:
        print(f"no user found with email {email!r} — have they signed up yet?")
        sys.exit(1)
    db.upsert_subscription(
        user_id=user["id"],
        provider="manual",
        provider_customer_id=None,
        provider_subscription_id=f"manual-{user['id']}",
        plan="supporter",
        status="active",
        current_period_end=None,
    )
    print(f"{email} now has an active subscription. Pro pages (pro-turtle.html) and coaching chat are unlocked for them.")


if __name__ == "__main__":
    db.init_db()
    main()
