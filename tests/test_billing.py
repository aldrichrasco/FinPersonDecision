import unittest
import uuid

import billing
import server


class BillingUnconfiguredTests(unittest.TestCase):
    """No STRIPE_* env vars are set in this test environment, so
    billing_configured() is False and every route must fail safely — this
    is the only behavior testable without real Stripe test-mode credentials."""

    def setUp(self):
        self.client = server.app.test_client()
        self.assertFalse(billing.billing_configured(), "test .env must not set STRIPE_* vars")

    def test_status_anonymous_returns_null_plan(self):
        response = self.client.get('/api/billing/status')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()['plan'])

    def test_status_reports_yearly_unavailable_when_unconfigured(self):
        # No STRIPE_PRICE_ID_YEARLY in this environment, so the pricing page
        # must not be told a yearly plan exists.
        response = self.client.get('/api/billing/status')
        self.assertFalse(response.get_json()['yearly_available'])

    def test_webhook_returns_503_when_unconfigured(self):
        response = self.client.post('/api/billing/webhook', data=b'{}', headers={'Stripe-Signature': 'anything'})
        self.assertEqual(response.status_code, 503)

    def test_create_checkout_session_requires_signin(self):
        response = self.client.post('/api/billing/create-checkout-session')
        self.assertEqual(response.status_code, 401)

    def test_create_checkout_session_returns_503_when_unconfigured(self):
        email = f"billing-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post('/api/auth/signup', json={'email': email, 'password': 'testpass123'})
        self.assertEqual(signup.status_code, 200)
        response = self.client.post('/api/billing/create-checkout-session')
        self.assertEqual(response.status_code, 503)


class BillingWebhookSignatureTests(unittest.TestCase):
    """Signature verification is pure local HMAC — no network call — so this
    is testable with placeholder keys, unlike actually creating a Checkout
    session (which needs a real Stripe test-mode secret key)."""

    def setUp(self):
        self.client = server.app.test_client()
        self._orig = (billing.SECRET_KEY, billing.WEBHOOK_SECRET, billing.PRICE_ID)
        billing.SECRET_KEY = "sk_test_fake"
        billing.WEBHOOK_SECRET = "whsec_fake"
        billing.PRICE_ID = "price_fake"

    def tearDown(self):
        billing.SECRET_KEY, billing.WEBHOOK_SECRET, billing.PRICE_ID = self._orig

    def test_webhook_rejects_bad_signature(self):
        response = self.client.post(
            '/api/billing/webhook',
            data=b'{"type": "checkout.session.completed"}',
            headers={'Stripe-Signature': 'not-a-real-signature'},
        )
        self.assertEqual(response.status_code, 400)

    def test_webhook_rejects_missing_signature(self):
        response = self.client.post('/api/billing/webhook', data=b'{}')
        self.assertEqual(response.status_code, 400)

    def test_webhook_rejects_correctly_formatted_but_wrong_signature(self):
        # A syntactically valid Stripe-Signature header (timestamp + v1 hash)
        # but computed with the wrong secret — must still be rejected, not
        # just malformed-header cases.
        import hashlib
        import hmac
        payload = b'{"type": "checkout.session.completed"}'
        timestamp = "1234567890"
        wrong_sig = hmac.new(b"whsec_wrong_secret", f"{timestamp}.{payload.decode()}".encode(), hashlib.sha256).hexdigest()
        header = f"t={timestamp},v1={wrong_sig}"
        response = self.client.post('/api/billing/webhook', data=payload, headers={'Stripe-Signature': header})
        self.assertEqual(response.status_code, 400)


if __name__ == '__main__':
    unittest.main()
