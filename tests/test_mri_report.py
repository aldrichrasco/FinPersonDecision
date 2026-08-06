import unittest
import uuid

import mri_report
import server


class SelfReportSectionTests(unittest.TestCase):
    def test_none_when_no_profile(self):
        self.assertIsNone(mri_report.self_report_section(None))
        self.assertIsNone(mri_report.self_report_section({}))

    def test_returns_profile_and_archetype(self):
        blob = {"profile": {"impulse_regulation": 80, "risk_disposition": 25}, "archetype": "steady_saver"}
        result = mri_report.self_report_section(blob)
        self.assertEqual(result["archetype"], "steady_saver")
        self.assertEqual(result["profile"]["risk_disposition"], 25)

    def test_closeness_is_high_for_a_profile_matching_its_archetype_exactly(self):
        axis_keys, profiles = mri_report._load_archetype_profiles()
        target = profiles["steady_saver"]
        blob = {"profile": dict(target), "archetype": "steady_saver"}
        result = mri_report.self_report_section(blob)
        self.assertEqual(result["closeness"], 100)

    def test_closeness_is_none_for_an_unknown_archetype(self):
        blob = {"profile": {"impulse_regulation": 50}, "archetype": "not_a_real_archetype"}
        result = mri_report.self_report_section(blob)
        self.assertIsNone(result["closeness"])


class OverrideDirectionBiasTests(unittest.TestCase):
    def test_no_overrides_gives_zero_bias_and_zero_count(self):
        rounds = [{"signal": "buy", "playerAction": "buy", "overridden": False}]
        net, count = mri_report._override_direction_bias(rounds)
        self.assertEqual((net, count), (0, 0))

    def test_more_aggressive_override_is_positive(self):
        rounds = [{"signal": "hold", "playerAction": "buy", "overridden": True}]
        net, count = mri_report._override_direction_bias(rounds)
        self.assertEqual((net, count), (1, 1))

    def test_more_conservative_override_is_negative(self):
        rounds = [{"signal": "buy", "playerAction": "sell", "overridden": True}]
        net, count = mri_report._override_direction_bias(rounds)
        self.assertEqual((net, count), (-1, 1))

    def test_non_overridden_rounds_never_counted_even_if_actions_differ_in_rank(self):
        # overridden is the authoritative flag; a malformed row without it shouldn't count
        rounds = [{"signal": "hold", "playerAction": "buy", "overridden": False}]
        net, count = mri_report._override_direction_bias(rounds)
        self.assertEqual((net, count), (0, 0))


class TurtleSimSectionTests(unittest.TestCase):
    def test_no_sessions(self):
        self.assertEqual(mri_report.turtle_sim_section([]), {"sessions": 0})

    def test_direction_bias_is_none_below_the_minimum_override_threshold(self):
        sessions = [{
            "final_rule_equity": 1.0, "final_player_equity": 1.0,
            "rounds": [{"signal": "hold", "playerAction": "buy", "overridden": True}],
        }]
        result = mri_report.turtle_sim_section(sessions)
        self.assertEqual(result["total_overrides"], 1)
        self.assertIsNone(result["override_direction_bias"])

    def test_direction_bias_reported_once_threshold_met(self):
        rounds = [{"signal": "hold", "playerAction": "buy", "overridden": True}] * 3
        sessions = [{"final_rule_equity": 1.0, "final_player_equity": 1.0, "rounds": rounds}]
        result = mri_report.turtle_sim_section(sessions)
        self.assertEqual(result["total_overrides"], 3)
        self.assertEqual(result["override_direction_bias"], 3)

    def test_beat_rule_rate_counts_sessions_where_player_matched_or_beat_rule(self):
        sessions = [
            {"final_rule_equity": 1.0, "final_player_equity": 1.1, "rounds": []},
            {"final_rule_equity": 1.0, "final_player_equity": 0.9, "rounds": []},
        ]
        result = mri_report.turtle_sim_section(sessions)
        self.assertEqual(result["beat_rule_rate_pct"], 50.0)


class CryptoImpulseSectionTests(unittest.TestCase):
    def test_no_decisions(self):
        self.assertEqual(mri_report.crypto_impulse_section([]), {"decisions": 0})

    def test_counts_choices_and_averages_outcome(self):
        decisions = [
            {"choice": "buy", "outcome_pct_change": 10},
            {"choice": "buy", "outcome_pct_change": -4},
            {"choice": "hold", "outcome_pct_change": 2},
        ]
        result = mri_report.crypto_impulse_section(decisions)
        self.assertEqual(result["decisions"], 3)
        self.assertEqual(result["choice_counts"], {"buy": 2, "hold": 1, "sell": 0})
        self.assertAlmostEqual(result["avg_outcome_pct_change"], (10 - 4 + 2) / 3, places=2)


class PracticeVolumeSectionTests(unittest.TestCase):
    def test_empty_inputs(self):
        result = mri_report.practice_volume_section(None, None)
        self.assertEqual(result, {"levels_completed": 0, "training_reps": 0, "axes_in_training": 0})

    def test_sums_reps_across_levels(self):
        roadmap = {"completed": ["growth", "fees", "emergency"]}
        training = {"payday": {"repCount": 2}, "emergency": {"repCount": 1}}
        result = mri_report.practice_volume_section(roadmap, training)
        self.assertEqual(result["levels_completed"], 3)
        self.assertEqual(result["training_reps"], 3)
        self.assertEqual(result["axes_in_training"], 2)


class RevealedVsStatedNoteTests(unittest.TestCase):
    def test_none_without_self_report(self):
        self.assertIsNone(mri_report.revealed_vs_stated_note(None, {"override_direction_bias": 5}))

    def test_none_without_enough_override_data(self):
        self_report = {"profile": {"risk_disposition": 20}}
        self.assertIsNone(mri_report.revealed_vs_stated_note(self_report, {"override_direction_bias": None}))

    def test_flags_stated_averse_but_revealed_aggressive(self):
        self_report = {"profile": {"risk_disposition": 20}}
        note = mri_report.revealed_vs_stated_note(self_report, {"override_direction_bias": 4})
        self.assertIsNotNone(note)
        self.assertIn("risk-averse", note)

    def test_flags_stated_tolerant_but_revealed_cautious(self):
        self_report = {"profile": {"risk_disposition": 80}}
        note = mri_report.revealed_vs_stated_note(self_report, {"override_direction_bias": -4})
        self.assertIsNotNone(note)
        self.assertIn("risk-tolerant", note)

    def test_no_note_when_stated_and_revealed_agree(self):
        self_report = {"profile": {"risk_disposition": 20}}
        note = mri_report.revealed_vs_stated_note(self_report, {"override_direction_bias": -3})
        self.assertIsNone(note)

    def test_no_note_for_a_balanced_self_report(self):
        self_report = {"profile": {"risk_disposition": 50}}
        note = mri_report.revealed_vs_stated_note(self_report, {"override_direction_bias": 4})
        self.assertIsNone(note)


class BuildReportTests(unittest.TestCase):
    def test_builds_all_sections_even_with_no_data(self):
        report = mri_report.build_report(None, [], [], None, None)
        self.assertIsNone(report["self_report"])
        self.assertEqual(report["turtle_sim"], {"sessions": 0})
        self.assertEqual(report["crypto_impulse"], {"decisions": 0})
        self.assertIsNone(report["revealed_vs_stated_note"])


class MriReportRouteTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_anonymous_gets_401(self):
        response = self.client.get('/api/mri/report')
        self.assertEqual(response.status_code, 401)

    def test_signed_in_without_subscription_gets_402(self):
        email = f"mri-test-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post('/api/auth/signup', json={'email': email, 'password': 'testpass123'})
        self.assertEqual(signup.status_code, 200)
        response = self.client.get('/api/mri/report')
        self.assertEqual(response.status_code, 402)
        self.assertTrue(response.get_json().get('paywall'))


if __name__ == "__main__":
    unittest.main()
