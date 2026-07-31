import unittest
import uuid

import server
import study


class StudyCompletionCodeTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()
        self.code = f"TESTCODE-{uuid.uuid4().hex[:8]}".upper()
        self._original_completion_code = study.COMPLETION_CODE

    def tearDown(self):
        study.COMPLETION_CODE = self._original_completion_code

    def _headers(self):
        return {"X-Study-Code": self.code}

    def test_not_enrolled_reports_not_enrolled(self):
        response = self.client.get('/api/study/status', headers=self._headers())
        self.assertEqual(response.get_json(), {"enrolled": False})

    def test_enrolled_but_not_consented_never_reveals_the_code(self):
        study.COMPLETION_CODE = "SECRET123"
        self.client.post('/api/study/enrol', json={'code': self.code})
        response = self.client.get('/api/study/status', headers=self._headers())
        data = response.get_json()
        self.assertFalse(data['consented'])
        self.assertIsNone(data['completion_code'])

    def test_consented_but_no_batch_code_configured_returns_none(self):
        study.COMPLETION_CODE = ""
        self.client.post('/api/study/enrol', json={'code': self.code})
        self.client.post('/api/study/consent', json={'agreed': True}, headers=self._headers())
        response = self.client.get('/api/study/status', headers=self._headers())
        self.assertIsNone(response.get_json()['completion_code'])

    def test_consented_with_batch_code_configured_reveals_it(self):
        study.COMPLETION_CODE = "SECRET123"
        self.client.post('/api/study/enrol', json={'code': self.code})
        self.client.post('/api/study/consent', json={'agreed': True}, headers=self._headers())
        response = self.client.get('/api/study/status', headers=self._headers())
        data = response.get_json()
        self.assertTrue(data['consented'])
        self.assertEqual(data['completion_code'], "SECRET123")

    def test_a_different_participants_code_does_not_leak_across_codes(self):
        study.COMPLETION_CODE = "SHARED-BATCH-CODE"
        other_code = f"OTHER-{uuid.uuid4().hex[:8]}".upper()
        self.client.post('/api/study/enrol', json={'code': other_code})
        # Never consented under `other_code` — status for our own unrelated
        # code should still show not-enrolled, not leak the other one's state.
        response = self.client.get('/api/study/status', headers=self._headers())
        self.assertEqual(response.get_json(), {"enrolled": False})


if __name__ == '__main__':
    unittest.main()
