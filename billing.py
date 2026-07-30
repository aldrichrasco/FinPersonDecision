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

Without these set, billing_configured() returns False and every route in
server.py that depends on it returns a clean 503 rather than crashing — same
safe-fallback pattern as llm.py when no LLM provider key is set.
"""

import os

SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET")
PRICE_ID = os.environ.get("STRIPE_PRICE_ID")


class BillingError(Exception):
    pass


def billing_configured():
    return bool(SECRET_KEY and WEBHOOK_SECRET and PRICE_ID)


def _stripe():
    try:
        import stripe
    except ImportError:
        raise BillingError("stripe SDK not installed — pip install -r requirements.txt")
    stripe.api_key = SECRET_KEY
    return stripe


def create_checkout_session(customer_email, success_url, cancel_url, client_reference_id):
    """Returns the Stripe-hosted Checkout URL to redirect the browser to.
    `client_reference_id` (our own user_id, as a string) is echoed back on
    the checkout.session.completed webhook so it can be linked to a
    FinPerson account — Stripe has no other way to know who this is."""
    if not billing_configured():
        raise BillingError("billing not configured")
    stripe = _stripe()
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": PRICE_ID, "quantity": 1}],
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
