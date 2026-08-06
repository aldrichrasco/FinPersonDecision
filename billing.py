"""
Stripe billing — Checkout session creation + webhook verification.

Stripe's own hosted Checkout page collects card details; FinPerson never
sees or stores them (same trust model as the Ko-fi/Buy Me a Coffee links in
donate.html). This module only talks to Stripe's API to start a session and
to verify/parse webhook deliveries — it never decides what a subscription
unlocks. Nothing in the app gates on subscription status yet; `subscriptions`
(see db.py) just starts getting real rows instead of staying empty.

Environment variables:
    STRIPE_SECRET_KEY       sk_test_... or sk_live_...
    STRIPE_WEBHOOK_SECRET   whsec_... (from the Stripe webhook endpoint config)
    STRIPE_PRICE_ID         price_... for the monthly-supporter subscription
    STRIPE_PRICE_ID_YEARLY  price_... for the yearly plan (OPTIONAL)

Only the monthly price is required. STRIPE_PRICE_ID_YEARLY is optional so
the yearly option on pricing.html degrades cleanly: if it isn't set, a
yearly checkout request falls back to the monthly price rather than
failing, and yearly_available() lets the UI hide the toggle entirely.
Both prices must be created in the Stripe dashboard — this file never
decides an amount, it only references a price id.

Without these set, billing_configured() returns False and every route in
server.py that depends on it returns a clean 503 rather than crashing — same
safe-fallback pattern as llm.py when no LLM provider key is set.
"""

import os

SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
PRICE_ID = os.environ.get("STRIPE_PRICE_ID")
PRICE_ID_YEARLY = os.environ.get("STRIPE_PRICE_ID_YEARLY")


class BillingError(Exception):
    pass


def billing_configured():
    return bool(SECRET_KEY and WEBHOOK_SECRET and PRICE_ID)


def yearly_available():
    """True only when a distinct yearly price id is configured — the UI
    uses this to decide whether to offer the yearly toggle at all, rather
    than advertising a plan that would silently charge monthly."""
    return bool(billing_configured() and PRICE_ID_YEARLY)


def _price_for(interval):
    """Falls back to the monthly price when yearly isn't configured, so a
    stale/hand-crafted `interval=yearly` request can never 500 — it just
    buys the plan that actually exists."""
    if interval == "yearly" and PRICE_ID_YEARLY:
        return PRICE_ID_YEARLY
    return PRICE_ID


def _stripe():
    try:
        import stripe
    except ImportError:
        raise BillingError("stripe SDK not installed — pip install -r requirements.txt")
    stripe.api_key = SECRET_KEY
    return stripe


def create_checkout_session(customer_email, success_url, cancel_url, client_reference_id, interval="monthly"):
    """Returns the Stripe-hosted Checkout URL to redirect the browser to.
    `client_reference_id` (our own user_id, as a string) is echoed back on
    the checkout.session.completed webhook so it can be linked to a
    FinPerson account — Stripe has no other way to know who this is.
    `interval` is "monthly" (default) or "yearly"; see _price_for()."""
    if not billing_configured():
        raise BillingError("billing not configured")
    stripe = _stripe()
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": _price_for(interval), "quantity": 1}],
            customer_email=customer_email,
            client_reference_id=client_reference_id,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except Exception as err:
        raise BillingError(f"could not create checkout session: {err}")
    return session.url


def parse_webhook_event(payload, sig_header):
    """Verifies the Stripe-Signature header against the raw request body.
    Raises BillingError on a missing/invalid signature — callers must treat
    that as a rejected request, never process an unverified payload."""
    if not billing_configured():
        raise BillingError("billing not configured")
    stripe = _stripe()
    try:
        return stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
    except Exception as err:
        raise BillingError(f"invalid webhook signature: {err}")
