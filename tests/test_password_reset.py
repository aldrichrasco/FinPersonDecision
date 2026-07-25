import hashlib
import unittest
import uuid

from werkzeug.security import generate_password_hash

import db
import server


class PasswordResetTests(unittest.TestCase):
    def setUp(self):
        # Created directly through db.py rather than via /api/auth/signup —
        # that route shares a small, real rate-limit budget with every other
        # test file in the suite (see ratelimit.py), and this file only
        # needs a password-holding user to exist, not to exercise signup
        # itself (already covered by test_research_consent.py).
        self.client = server.app.test_client()
        self.email = f"reset-test-{uuid.uuid4().hex[:12]}@example.com"
        user = db.create_password_user(self.email, generate_password_hash('oldpassword1'), 'Reset Test')
        self.assertIsNotNone(user)

    def _issue_token(self):
        user = db.get_user_by_email(self.email)
        token = f"test-token-{uuid.uuid4().hex}"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        db.create_password_reset(user['id'], token_hash, ttl_seconds=3600)
        return token

    def test_forgot_password_always_returns_ok(self):
        response = self.client.post(
            '/api/auth/forgot-password',
            json={'email': self.email},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['ok'], True)

    def test_forgot_password_does_not_reveal_unknown_email(self):
        response = self.client.post(
            '/api/auth/forgot-password',
            json={'email': f"nobody-{uuid.uuid4().hex[:8]}@example.com"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['ok'], True)

    def test_reset_password_with_valid_token(self):
        token = self._issue_token()
        response = self.client.post(
            '/api/auth/reset-password',
            json={'token': token, 'password': 'newpassword2'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()['ok'], True)

        # Old password no longer works, new one does.
        old_login = self.client.post(
            '/api/auth/login',
            json={'email': self.email, 'password': 'oldpassword1'},
        )
        self.assertEqual(old_login.status_code, 401)

        new_login = self.client.post(
            '/api/auth/login',
            json={'email': self.email, 'password': 'newpassword2'},
        )
        self.assertEqual(new_login.status_code, 200)

    def test_reset_token_cannot_be_reused(self):
        token = self._issue_token()
        first = self.client.post(
            '/api/auth/reset-password',
            json={'token': token, 'password': 'newpassword2'},
        )
        self.assertEqual(first.status_code, 200)

        second = self.client.post(
            '/api/auth/reset-password',
            json={'token': token, 'password': 'anotherpass3'},
        )
        self.assertEqual(second.status_code, 400)

    def test_reset_password_rejects_bad_token(self):
        response = self.client.post(
            '/api/auth/reset-password',
            json={'token': 'not-a-real-token', 'password': 'newpassword2'},
        )
        self.assertEqual(response.status_code, 400)

    def test_reset_password_rejects_short_password(self):
        token = self._issue_token()
        response = self.client.post(
            '/api/auth/reset-password',
            json={'token': token, 'password': 'short'},
        )
        self.assertEqual(response.status_code, 400)


if __name__ == '__main__':
    unittest.main()
