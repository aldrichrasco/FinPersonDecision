import unittest
import uuid

import server


class IdmStateAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_get_returns_empty_state(self):
        response = self.client.get('/api/idm-state')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'state': {}})

    def test_anonymous_post_is_a_noop(self):
        response = self.client.post('/api/idm-state', json={'state': {'catch_up_later': {'encounters': 1}}})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'ok': True})


class IdmStateSignedInTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"idm-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post(
            '/api/auth/signup',
            json={'email': email, 'password': 'testpass123'},
        )
        self.assertEqual(signup.status_code, 200)

    def test_state_round_trips(self):
        state = {'catch_up_later': {'encounters': 3, 'bestC': 'C2', 'surfacesSeen': ['credit_card']}}
        post = self.client.post('/api/idm-state', json={'state': state})
        self.assertEqual(post.status_code, 200)

        get = self.client.get('/api/idm-state')
        self.assertEqual(get.status_code, 200)
        self.assertEqual(get.get_json()['state'], state)


if __name__ == '__main__':
    unittest.main()
