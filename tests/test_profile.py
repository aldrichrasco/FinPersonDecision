import unittest
import uuid

import server

VALID_PROFILE = {
    "impulse_regulation": 50,
    "risk_disposition": 50,
    "temporal_orientation": 50,
    "financial_attentiveness": 50,
    "financial_self_efficacy": 50,
    "prosocial_orientation": 50,
}


class ProfileAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_get_returns_null_profile(self):
        response = self.client.get('/api/profile')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'profile': None})

    def test_anonymous_post_is_a_noop(self):
        response = self.client.post('/api/profile', json={
            'profile': VALID_PROFILE, 'archetype': 'steady_saver', 'capability': 50, 'at': 1000,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'ok': True})

    def test_invalid_body_rejected(self):
        response = self.client.post('/api/profile', json={'profile': 'not-a-dict'})
        self.assertEqual(response.status_code, 400)

    def test_missing_axis_rejected(self):
        incomplete = dict(VALID_PROFILE)
        del incomplete['risk_disposition']
        response = self.client.post('/api/profile', json={
            'profile': incomplete, 'archetype': 'steady_saver', 'capability': 50, 'at': 1000,
        })
        self.assertEqual(response.status_code, 400)

    def test_out_of_range_axis_value_rejected(self):
        bad = dict(VALID_PROFILE, risk_disposition=150)
        response = self.client.post('/api/profile', json={
            'profile': bad, 'archetype': 'steady_saver', 'capability': 50, 'at': 1000,
        })
        self.assertEqual(response.status_code, 400)

    def test_nudge_log_get_returns_empty_when_anonymous(self):
        response = self.client.get('/api/profile/nudge-log')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'entries': []})

    def test_nudge_log_post_is_a_noop_when_anonymous(self):
        response = self.client.post('/api/profile/nudge-log', json={
            'axis': 'risk_disposition', 'delta': 3, 'source': 'test',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'ok': True})


class ProfileSignedInTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"profile-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post(
            '/api/auth/signup',
            json={'email': email, 'password': 'testpass123'},
        )
        self.assertEqual(signup.status_code, 200)

    def test_get_before_any_save_returns_null(self):
        response = self.client.get('/api/profile')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'profile': None})

    def test_profile_round_trip(self):
        post = self.client.post('/api/profile', json={
            'profile': VALID_PROFILE, 'archetype': 'steady_saver', 'capability': 62, 'at': 12345,
        })
        self.assertEqual(post.status_code, 200)

        get = self.client.get('/api/profile')
        self.assertEqual(get.status_code, 200)
        stored = get.get_json()['profile']
        self.assertEqual(stored['profile'], VALID_PROFILE)
        self.assertEqual(stored['archetype'], 'steady_saver')
        self.assertEqual(stored['capability'], 62)
        self.assertEqual(stored['at'], 12345)

    def test_second_save_overwrites_first(self):
        self.client.post('/api/profile', json={
            'profile': VALID_PROFILE, 'archetype': 'steady_saver', 'capability': 50, 'at': 1,
        })
        updated = dict(VALID_PROFILE, risk_disposition=80)
        self.client.post('/api/profile', json={
            'profile': updated, 'archetype': 'strategic_risk_taker', 'capability': 55, 'at': 2,
        })
        get = self.client.get('/api/profile')
        stored = get.get_json()['profile']
        self.assertEqual(stored['profile']['risk_disposition'], 80)
        self.assertEqual(stored['archetype'], 'strategic_risk_taker')

    def test_invalid_archetype_rejected(self):
        response = self.client.post('/api/profile', json={
            'profile': VALID_PROFILE, 'archetype': 'not-a-real-archetype', 'capability': 50, 'at': 1,
        })
        self.assertEqual(response.status_code, 400)

    def test_nudge_log_empty_before_any_nudge(self):
        response = self.client.get('/api/profile/nudge-log')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'entries': []})

    def test_nudge_log_round_trip(self):
        post = self.client.post('/api/profile/nudge-log', json={
            'axis': 'risk_disposition', 'delta': 4, 'source': 'classroom:trust:investor',
        })
        self.assertEqual(post.status_code, 200)

        get = self.client.get('/api/profile/nudge-log')
        entries = get.get_json()['entries']
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]['axis'], 'risk_disposition')
        self.assertEqual(entries[0]['delta'], 4)
        self.assertEqual(entries[0]['source'], 'classroom:trust:investor')

    def test_nudge_log_invalid_axis_rejected(self):
        response = self.client.post('/api/profile/nudge-log', json={
            'axis': 'not_a_real_axis', 'delta': 2, 'source': 'test',
        })
        self.assertEqual(response.status_code, 400)

    def test_nudge_log_out_of_range_delta_rejected(self):
        response = self.client.post('/api/profile/nudge-log', json={
            'axis': 'risk_disposition', 'delta': 10, 'source': 'test',
        })
        self.assertEqual(response.status_code, 400)


if __name__ == '__main__':
    unittest.main()
