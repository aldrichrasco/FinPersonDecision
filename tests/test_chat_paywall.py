import unittest
import uuid

import db
import server

PERSONA = "steady_saver"


def _messages(text):
    return {"messages": [{"role": "user", "content": text}]}


class ChatAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_requires_subscription(self):
        response = self.client.post(f'/api/chat/{PERSONA}', json=_messages("How should I think about saving more?"))
        self.assertEqual(response.status_code, 402)
        self.assertTrue(response.get_json()['paywall'])

    def test_safeguarding_bypasses_the_paywall(self):
        # A person in real distress must still get resources even with no
        # subscription and no session — the gate never blocks safeguarding.
        response = self.client.post(f'/api/chat/{PERSONA}', json=_messages("I want to die and don't see a way out"))
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['reply'], "")
        self.assertEqual(data['safeguarding']['severity'], 'crisis')

    def test_unknown_persona_still_404s_before_any_gate(self):
        response = self.client.post('/api/chat/not-a-real-persona', json=_messages("hi"))
        self.assertEqual(response.status_code, 404)


class ChatSignedInNoSubscriptionTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"chat-nosub-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post('/api/auth/signup', json={'email': email, 'password': 'testpass123'})
        self.assertEqual(signup.status_code, 200)

    def test_requires_subscription(self):
        response = self.client.post(f'/api/chat/{PERSONA}', json=_messages("How should I think about saving more?"))
        self.assertEqual(response.status_code, 402)
        self.assertTrue(response.get_json()['paywall'])

    def test_safeguarding_bypasses_the_paywall_when_signed_in(self):
        response = self.client.post(f'/api/chat/{PERSONA}', json=_messages("I can't afford to eat this week"))
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data['reply'], "")
        self.assertIn(data['safeguarding']['severity'], ('urgent', 'crisis'))


class ChatSubscribedTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"chat-sub-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post('/api/auth/signup', json={'email': email, 'password': 'testpass123'})
        self.assertEqual(signup.status_code, 200)
        with self.client.session_transaction() as sess:
            self.uid = sess['user_id']
        db.upsert_subscription(
            user_id=self.uid, provider='stripe', provider_customer_id='cus_test',
            provider_subscription_id=f'sub_test_{uuid.uuid4().hex[:12]}',
            plan='supporter', status='active', current_period_end=None,
        )

    def test_not_gated_by_the_paywall(self):
        # Never 402 for a subscribed user. Whether the LLM itself is
        # configured in this test environment is a separate concern (503 is
        # an acceptable, unrelated outcome here) — the paywall specifically
        # must not be what stops them.
        response = self.client.post(f'/api/chat/{PERSONA}', json=_messages("How should I think about saving more?"))
        self.assertNotEqual(response.status_code, 402)


if __name__ == '__main__':
    unittest.main()
