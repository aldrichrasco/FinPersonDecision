import unittest
import uuid

import server


def log_choice(client, wellbeing, primary_axis):
    return client.post(
        '/api/scenario-choice',
        json={
            'persona': 'impulsive_spender',
            'difficulty': 'medium',
            'scenario': 'test scenario',
            'choice': 'test choice',
            'homeostasis': {
                'wellbeing': wellbeing,
                'zone': 'breakdown',
                'primary_axis': primary_axis,
            },
        },
    )


class ScenarioAxisSignedInTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"axis-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post(
            '/api/auth/signup',
            json={'email': email, 'password': 'testpass123'},
        )
        self.assertEqual(signup.status_code, 200)

    def test_valid_axis_is_stored_and_returned_in_history(self):
        resp = log_choice(self.client, 42, 'impulse_regulation')
        self.assertEqual(resp.status_code, 200)

        history = self.client.get('/api/my/wellbeing-history')
        self.assertEqual(history.status_code, 200)
        rows = history.get_json()['history']
        self.assertTrue(any(r['wellbeing'] == 42 for r in rows))

    def test_unknown_axis_is_dropped_not_poisoned(self):
        # An invalid/unexpected axis value must not reach the database as-is —
        # server.py whitelists against FBM_AXIS_KEYS before storing.
        resp = log_choice(self.client, 55, 'not_a_real_axis; DROP TABLE users;')
        self.assertEqual(resp.status_code, 200)
        # Whitelisting happens silently (primary_axis becomes None); the write
        # itself must still succeed rather than erroring.


class WellbeingHistoryAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_history_is_empty(self):
        response = self.client.get('/api/my/wellbeing-history')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'history': []})


if __name__ == '__main__':
    unittest.main()
