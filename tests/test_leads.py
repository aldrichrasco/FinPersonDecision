import unittest

import db
import server


class EmailLeadTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_valid_email_is_accepted(self):
        response = self.client.post('/api/leads', json={
            'email': 'lead-test@example.com', 'source': 'quiz_result', 'archetype': 'anxious_avoider',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'ok': True})

    def test_invalid_email_is_rejected(self):
        response = self.client.post('/api/leads', json={'email': 'not-an-email'})
        self.assertEqual(response.status_code, 400)

    def test_missing_email_is_rejected(self):
        response = self.client.post('/api/leads', json={})
        self.assertEqual(response.status_code, 400)

    def test_invalid_json_body_is_rejected(self):
        response = self.client.post('/api/leads', data=b'not json', content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_lead_is_actually_persisted(self):
        email = 'persisted-lead@example.com'
        response = self.client.post('/api/leads', json={'email': f' {email.upper()} ', 'source': 'quiz_result'})
        self.assertEqual(response.status_code, 200)
        with db._conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT email, source FROM email_leads WHERE email = ?", (email,))
            row = cur.fetchone()
        self.assertIsNotNone(row, "email should be stored lowercased/trimmed")
        self.assertEqual(row[0], email)
        self.assertEqual(row[1], 'quiz_result')

    def test_anonymous_lead_has_no_user_id(self):
        response = self.client.post('/api/leads', json={'email': 'anon-lead@example.com'})
        self.assertEqual(response.status_code, 200)
        with db._conn() as conn:
            cur = conn.cursor()
            cur.execute("SELECT user_id FROM email_leads WHERE email = ?", ('anon-lead@example.com',))
            row = cur.fetchone()
        self.assertIsNone(row[0])


if __name__ == '__main__':
    unittest.main()
