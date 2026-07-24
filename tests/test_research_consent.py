import unittest
import uuid

import server


class ResearchConsentAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_get_requires_signin(self):
        response = self.client.get('/api/research/consent')
        self.assertEqual(response.status_code, 401)

    def test_anonymous_post_requires_signin(self):
        response = self.client.post(
            '/api/research/consent',
            json={'consent': True, 'source': 'onboarding'},
        )
        self.assertEqual(response.status_code, 401)


class ResearchConsentSignedInTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        email = f"consent-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post(
            '/api/auth/signup',
            json={'email': email, 'password': 'testpass123'},
        )
        self.assertEqual(signup.status_code, 200)

    def test_consent_defaults_to_opt_out(self):
        response = self.client.get('/api/research/consent')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['consent'], False)

    def test_consent_can_be_saved(self):
        response = self.client.post(
            '/api/research/consent',
            json={'consent': True, 'source': 'onboarding'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['ok'], True)

        response = self.client.get('/api/research/consent')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['consent'], True)


if __name__ == '__main__':
    unittest.main()
