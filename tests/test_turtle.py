import unittest
import uuid

import db
import server

VALID_ROUNDS = [
    {"index": 10, "signal": "buy", "playerAction": "buy", "overridden": False, "ruleReturnPct": 0.01, "playerReturnPct": 0.01},
    {"index": 11, "signal": "sell", "playerAction": "hold", "overridden": True, "ruleReturnPct": 0.02, "playerReturnPct": 0.0},
]


class TurtleAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_get_requires_signin(self):
        response = self.client.get('/api/turtle/session')
        self.assertEqual(response.status_code, 401)

    def test_post_requires_signin(self):
        response = self.client.post('/api/turtle/session', json={
            'rounds': VALID_ROUNDS, 'final_rule_equity': 1.05, 'final_player_equity': 1.01, 'override_count': 1,
        })
        self.assertEqual(response.status_code, 401)


class TurtleSignedInNoSubscriptionTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"turtle-nosub-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post('/api/auth/signup', json={'email': email, 'password': 'testpass123'})
        self.assertEqual(signup.status_code, 200)

    def test_get_requires_subscription(self):
        response = self.client.get('/api/turtle/session')
        self.assertEqual(response.status_code, 402)

    def test_post_requires_subscription(self):
        response = self.client.post('/api/turtle/session', json={
            'rounds': VALID_ROUNDS, 'final_rule_equity': 1.05, 'final_player_equity': 1.01, 'override_count': 1,
        })
        self.assertEqual(response.status_code, 402)


class TurtleSubscribedTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"turtle-sub-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post('/api/auth/signup', json={'email': email, 'password': 'testpass123'})
        self.assertEqual(signup.status_code, 200)
        with self.client.session_transaction() as sess:
            self.uid = sess['user_id']
        db.upsert_subscription(
            user_id=self.uid, provider='stripe', provider_customer_id='cus_test',
            provider_subscription_id=f'sub_test_{uuid.uuid4().hex[:12]}',
            plan='supporter', status='active', current_period_end=None,
        )

    def test_get_empty_before_any_session(self):
        response = self.client.get('/api/turtle/session')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'sessions': []})

    def test_session_round_trip(self):
        post = self.client.post('/api/turtle/session', json={
            'rounds': VALID_ROUNDS, 'final_rule_equity': 1.08, 'final_player_equity': 0.97, 'override_count': 1,
        })
        self.assertEqual(post.status_code, 200)

        get = self.client.get('/api/turtle/session')
        self.assertEqual(get.status_code, 200)
        sessions = get.get_json()['sessions']
        self.assertEqual(len(sessions), 1)
        self.assertAlmostEqual(sessions[0]['final_rule_equity'], 1.08)
        self.assertAlmostEqual(sessions[0]['final_player_equity'], 0.97)
        self.assertEqual(sessions[0]['override_count'], 1)

    def test_invalid_rounds_rejected(self):
        response = self.client.post('/api/turtle/session', json={
            'rounds': 'not-a-list', 'final_rule_equity': 1.0, 'final_player_equity': 1.0, 'override_count': 0,
        })
        self.assertEqual(response.status_code, 400)

    def test_invalid_equity_rejected(self):
        response = self.client.post('/api/turtle/session', json={
            'rounds': VALID_ROUNDS, 'final_rule_equity': 'not-a-number', 'final_player_equity': 1.0, 'override_count': 0,
        })
        self.assertEqual(response.status_code, 400)

    def test_negative_override_count_rejected(self):
        response = self.client.post('/api/turtle/session', json={
            'rounds': VALID_ROUNDS, 'final_rule_equity': 1.0, 'final_player_equity': 1.0, 'override_count': -1,
        })
        self.assertEqual(response.status_code, 400)


if __name__ == '__main__':
    unittest.main()
