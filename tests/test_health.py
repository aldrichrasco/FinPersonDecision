import unittest

import server


class HealthEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_health_returns_ok(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})
