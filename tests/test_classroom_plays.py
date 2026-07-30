import unittest
import uuid

import server


class ClassroomPlayTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_valid_trust_play_is_recorded(self):
        response = self.client.post('/api/classroom-play', json={
            'game': 'trust', 'role': 'investor', 'archetype': 'steady_saver',
            'detail': {'sent': 5, 'returned': 6, 'pool': 15},
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'ok': True})

    def test_invalid_game_rejected(self):
        response = self.client.post('/api/classroom-play', json={
            'game': 'not-a-real-game', 'role': 'investor', 'archetype': 'steady_saver', 'detail': {},
        })
        self.assertEqual(response.status_code, 400)

    def test_invalid_archetype_rejected(self):
        response = self.client.post('/api/classroom-play', json={
            'game': 'trust', 'role': 'investor', 'archetype': 'not-a-real-archetype', 'detail': {},
        })
        self.assertEqual(response.status_code, 400)

    def test_non_dict_detail_rejected(self):
        response = self.client.post('/api/classroom-play', json={
            'game': 'trust', 'role': 'investor', 'archetype': 'steady_saver', 'detail': 'not-a-dict',
        })
        self.assertEqual(response.status_code, 400)

    def test_stats_requires_valid_game(self):
        response = self.client.get('/api/classroom-stats?game=nonsense')
        self.assertEqual(response.status_code, 400)

    def test_stats_reflects_recorded_plays(self):
        self.client.post('/api/classroom-play', json={
            'game': 'ultimatum', 'role': 'responder', 'archetype': 'steady_saver',
            'detail': {'offer': 2, 'pot': 10, 'accepted': False},
        })
        self.client.post('/api/classroom-play', json={
            'game': 'ultimatum', 'role': 'responder', 'archetype': 'steady_saver',
            'detail': {'offer': 5, 'pot': 10, 'accepted': True},
        })
        response = self.client.get('/api/classroom-stats?game=ultimatum')
        self.assertEqual(response.status_code, 200)
        stats = response.get_json()
        self.assertGreaterEqual(stats['count'], 2)
        self.assertIsNotNone(stats['avg_offer_pct'])
        self.assertIsNotNone(stats['rejection_rate_pct'])

    def test_csv_export_returns_csv(self):
        self.client.post('/api/classroom-play', json={
            'game': 'trust', 'role': 'investor', 'archetype': 'steady_saver',
            'detail': {'sent': 5, 'returned': 6, 'pool': 15},
        })
        response = self.client.get('/api/classroom-stats?game=trust&format=csv')
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/csv', response.content_type)
        body = response.get_data(as_text=True)
        self.assertIn('role', body)
        self.assertIn('archetype', body)

    def test_invalid_cohort_rejected(self):
        response = self.client.post('/api/classroom-play', json={
            'game': 'trust', 'role': 'investor', 'archetype': 'steady_saver',
            'detail': {'sent': 5, 'returned': 6, 'pool': 15}, 'cohort': 'x' * 33,
        })
        self.assertEqual(response.status_code, 400)

    def test_blank_cohort_rejected(self):
        response = self.client.post('/api/classroom-play', json={
            'game': 'trust', 'role': 'investor', 'archetype': 'steady_saver',
            'detail': {'sent': 5, 'returned': 6, 'pool': 15}, 'cohort': '   ',
        })
        self.assertEqual(response.status_code, 400)

    def test_cohort_filters_stats(self):
        cohort_a = f"period-1-{uuid.uuid4().hex[:8]}"
        cohort_b = f"period-2-{uuid.uuid4().hex[:8]}"
        self.client.post('/api/classroom-play', json={
            'game': 'goods', 'role': 'player', 'archetype': 'steady_saver',
            'detail': {'firstRoundTotal': 40, 'lastRoundTotal': 40}, 'cohort': cohort_a,
        })
        self.client.post('/api/classroom-play', json={
            'game': 'goods', 'role': 'player', 'archetype': 'steady_saver',
            'detail': {'firstRoundTotal': 5, 'lastRoundTotal': 5}, 'cohort': cohort_b,
        })
        period1 = self.client.get(f'/api/classroom-stats?game=goods&cohort={cohort_a}').get_json()
        period2 = self.client.get(f'/api/classroom-stats?game=goods&cohort={cohort_b}').get_json()
        self.assertEqual(period1['count'], 1)
        self.assertEqual(period1['avg_first_round_total'], 40.0)
        self.assertEqual(period2['count'], 1)
        self.assertEqual(period2['avg_first_round_total'], 5.0)

    def test_cohort_csv_export_scoped_to_cohort(self):
        cohort = f"csv-cohort-{uuid.uuid4().hex[:8]}"
        self.client.post('/api/classroom-play', json={
            'game': 'trust', 'role': 'investor', 'archetype': 'steady_saver',
            'detail': {'sent': 5, 'returned': 6, 'pool': 15}, 'cohort': cohort,
        })
        response = self.client.get(f'/api/classroom-stats?game=trust&cohort={cohort}&format=csv')
        self.assertEqual(response.status_code, 200)
        rows = response.get_data(as_text=True).strip().splitlines()
        self.assertEqual(len(rows), 2)  # header + exactly the one cohort-tagged play


if __name__ == '__main__':
    unittest.main()
