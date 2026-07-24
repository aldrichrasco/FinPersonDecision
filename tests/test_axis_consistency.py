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


class AxisConsistencyAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_returns_empty(self):
        response = self.client.get('/api/my/axis-consistency')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'by_axis': {}})


class AxisConsistencySignedInTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"consistency-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post(
            '/api/auth/signup',
            json={'email': email, 'password': 'testpass123'},
        )
        self.assertEqual(signup.status_code, 200)

    def test_identical_wellbeing_gives_zero_variance(self):
        for _ in range(3):
            self.assertEqual(log_choice(self.client, 50, 'impulse_regulation').status_code, 200)

        response = self.client.get('/api/my/axis-consistency')
        self.assertEqual(response.status_code, 200)
        by_axis = response.get_json()['by_axis']
        self.assertIn('impulse_regulation', by_axis)
        self.assertEqual(by_axis['impulse_regulation']['count'], 3)
        self.assertEqual(by_axis['impulse_regulation']['variance'], 0)

    def test_varied_wellbeing_gives_positive_variance(self):
        for wb in (10, 90, 20, 80):
            self.assertEqual(log_choice(self.client, wb, 'risk_disposition').status_code, 200)

        response = self.client.get('/api/my/axis-consistency')
        by_axis = response.get_json()['by_axis']
        self.assertGreater(by_axis['risk_disposition']['variance'], 0)


if __name__ == '__main__':
    unittest.main()
