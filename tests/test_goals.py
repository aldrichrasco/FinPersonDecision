import unittest
import uuid

import server


class GoalsAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_get_returns_empty_list(self):
        response = self.client.get('/api/goals')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'goals': []})

    def test_anonymous_post_is_a_noop(self):
        response = self.client.post('/api/goals', json={'goals': [{'id': 'a', 'title': 'Save $500'}]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'ok': True})

    def test_invalid_body_rejected(self):
        response = self.client.post('/api/goals', json={'goals': 'not-a-list'})
        self.assertEqual(response.status_code, 400)


class GoalsSignedInTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"goals-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post(
            '/api/auth/signup',
            json={'email': email, 'password': 'testpass123'},
        )
        self.assertEqual(signup.status_code, 200)

    def test_goals_round_trip(self):
        goals = [
            {'id': 'g1', 'title': 'Emergency fund', 'note': 'buffer', 'targetAmount': 1000, 'savedAmount': 400, 'done': False},
            {'id': 'g2', 'title': 'Pay off card', 'note': '', 'targetAmount': None, 'savedAmount': 0, 'done': True},
        ]
        post = self.client.post('/api/goals', json={'goals': goals})
        self.assertEqual(post.status_code, 200)

        get = self.client.get('/api/goals')
        self.assertEqual(get.status_code, 200)
        stored = get.get_json()['goals']
        self.assertEqual(len(stored), 2)
        self.assertEqual(stored[0]['title'], 'Emergency fund')
        self.assertEqual(stored[0]['targetAmount'], 1000)
        self.assertEqual(stored[0]['savedAmount'], 400)
        self.assertFalse(stored[0]['done'])
        self.assertTrue(stored[1]['done'])

    def test_malformed_entries_are_dropped(self):
        goals = [
            {'id': 'ok', 'title': 'Valid goal'},
            {'id': 'no-title'},
            {'title': 'no-id'},
            'not-a-dict',
            {'id': 'blank', 'title': '   '},
        ]
        response = self.client.post('/api/goals', json={'goals': goals})
        self.assertEqual(response.status_code, 200)
        get = self.client.get('/api/goals')
        stored = get.get_json()['goals']
        self.assertEqual(len(stored), 1)
        self.assertEqual(stored[0]['id'], 'ok')

    def test_empty_get_before_any_save(self):
        response = self.client.get('/api/goals')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'goals': []})


if __name__ == '__main__':
    unittest.main()
