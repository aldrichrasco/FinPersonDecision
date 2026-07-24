import unittest

import server


class SandboxStateAnonymousTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        with self.client.session_transaction() as sess:
            sess.clear()

    def test_anonymous_get_returns_empty_state(self):
        response = self.client.get("/api/sandbox-state")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"state": {}})

    def test_anonymous_post_returns_ok(self):
        response = self.client.post(
            "/api/sandbox-state",
            json={"state": {"score": 1}},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"ok": True})


if __name__ == "__main__":
    unittest.main()
