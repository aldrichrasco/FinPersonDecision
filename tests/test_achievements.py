import unittest
import uuid

import server


class AchievementsAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_get_returns_empty_list(self):
        response = self.client.get('/api/achievements')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'unlocked': []})

    def test_anonymous_post_is_a_noop(self):
        response = self.client.post('/api/achievements', json={'unlocked': ['first_steps']})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'ok': True})


class AchievementsSignedInTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"achievements-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post(
            '/api/auth/signup',
            json={'email': email, 'password': 'testpass123'},
        )
        self.assertEqual(signup.status_code, 200)

    def test_unlocked_ids_round_trip(self):
        ids = ['first_steps', 'into_the_sandbox']
        post = self.client.post('/api/achievements', json={'unlocked': ids})
        self.assertEqual(post.status_code, 200)

        get = self.client.get('/api/achievements')
        self.assertEqual(get.status_code, 200)
        self.assertEqual(sorted(get.get_json()['unlocked']), sorted(ids))

    def test_non_string_ids_are_dropped(self):
        response = self.client.post('/api/achievements', json={'unlocked': ['ok', 123, None, {'a': 1}]})
        self.assertEqual(response.status_code, 200)
        get = self.client.get('/api/achievements')
        self.assertEqual(get.get_json()['unlocked'], ['ok'])


if __name__ == '__main__':
    unittest.main()
