import unittest
import uuid

import server


class LearnProgressAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_get_returns_empty_progress(self):
        response = self.client.get('/api/learn/progress')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'progress': {}})

    def test_anonymous_post_is_a_noop(self):
        response = self.client.post(
            '/api/learn/progress',
            json={'progress': {'completed': ['impulse_regulation:0'], 'xp': 10}},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'ok': True})

    def test_invalid_body_rejected(self):
        response = self.client.post('/api/learn/progress', json={'progress': 'not-a-dict'})
        self.assertEqual(response.status_code, 400)


class LearnProgressSignedInTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"learn-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post(
            '/api/auth/signup',
            json={'email': email, 'password': 'testpass123'},
        )
        self.assertEqual(signup.status_code, 200)

    def test_progress_round_trips(self):
        payload = {'completed': ['impulse_regulation:0', 'risk_disposition:1'], 'xp': 20, 'streak': 2}
        post = self.client.post('/api/learn/progress', json={'progress': payload})
        self.assertEqual(post.status_code, 200)

        get = self.client.get('/api/learn/progress')
        self.assertEqual(get.status_code, 200)
        self.assertEqual(get.get_json()['progress'], payload)


if __name__ == '__main__':
    unittest.main()
