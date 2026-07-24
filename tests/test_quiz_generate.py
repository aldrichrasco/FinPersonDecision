import unittest

import server
import study


class QuizGenerateGateTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_invalid_axis_returns_204(self):
        response = self.client.post(
            '/api/quiz/generate-question',
            json={'situation': 'test', 'axisA': 'not_a_real_axis', 'axisB': 'impulse_regulation'},
        )
        self.assertEqual(response.status_code, 204)

    def test_missing_body_returns_204(self):
        response = self.client.post('/api/quiz/generate-question', json={})
        self.assertEqual(response.status_code, 204)

    def test_enrolled_study_participant_gets_204_regardless_of_llm(self):
        # An enrolled, consented participant must always fall back to the
        # fixed TIEBREAKER_QUESTIONS bank (stimulus control for the DSS
        # paper) — this must hold even with a syntactically valid request.
        code = 'TESTCODE123'
        study.enrol(code)
        study.record_consent(code)
        response = self.client.post(
            '/api/quiz/generate-question',
            json={'situation': 'test', 'axisA': 'impulse_regulation', 'axisB': 'risk_disposition'},
            headers={'X-Study-Code': code},
        )
        self.assertEqual(response.status_code, 204)


if __name__ == '__main__':
    unittest.main()
