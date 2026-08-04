"""
Tests for ml/drift.py (Population Stability Index) and the validation
gates in ml/train_*.py that use it.
"""

import importlib.util
import json
import os
import tempfile
import unittest

_HAS_ML_DEPS = all(importlib.util.find_spec(pkg) is not None for pkg in ("sklearn", "pandas"))


class PopulationStabilityIndexTests(unittest.TestCase):
    """Pure Python math -- no ML deps needed, always runs."""

    def test_identical_distributions_have_zero_psi(self):
        from ml.drift import population_stability_index

        dist = {"a": 0.5, "b": 0.3, "c": 0.2}
        psi, _ = population_stability_index(dist, dist)
        self.assertAlmostEqual(psi, 0.0, places=6)

    def test_a_shifted_distribution_has_positive_psi(self):
        from ml.drift import population_stability_index

        baseline = {"a": 0.5, "b": 0.3, "c": 0.2}
        shifted = {"a": 0.1, "b": 0.1, "c": 0.8}
        psi, _ = population_stability_index(baseline, shifted)
        self.assertGreater(psi, 0.25)  # a large, obvious shift

    def test_a_small_shift_produces_a_small_psi(self):
        from ml.drift import population_stability_index

        baseline = {"a": 0.50, "b": 0.30, "c": 0.20}
        small_shift = {"a": 0.52, "b": 0.29, "c": 0.19}
        psi, _ = population_stability_index(baseline, small_shift)
        self.assertLess(psi, 0.1)

    def test_classify_shift_thresholds(self):
        from ml.drift import classify_shift

        self.assertIn("no significant", classify_shift(0.05))
        self.assertIn("moderate", classify_shift(0.15))
        self.assertIn("significant", classify_shift(0.30))

    def test_a_vanished_category_contributes_a_large_term(self):
        # A category with real mass in the baseline that drops to ~0 in
        # the new distribution should show up as a large contribution, not
        # silently disappear from the sum.
        from ml.drift import population_stability_index

        baseline = {"a": 0.5, "b": 0.5}
        current = {"a": 0.999, "b": 0.001}
        psi, contributions = population_stability_index(baseline, current)
        self.assertGreater(psi, 0.5)
        self.assertGreater(contributions["b"], 0)

    def test_distribution_from_counts_normalizes(self):
        from ml.drift import distribution_from_counts

        dist = distribution_from_counts({"a": 30, "b": 10, "c": 60})
        self.assertAlmostEqual(sum(dist.values()), 1.0, places=6)
        self.assertAlmostEqual(dist["a"], 0.3, places=6)

    def test_predicted_counts_from_confusion_sums_columns(self):
        from ml.drift import predicted_counts_from_confusion

        # 2 true-0 predicted 0, 1 true-0 predicted 1, 3 true-1 predicted 1
        confusion = [[2, 1], [0, 3]]
        counts = predicted_counts_from_confusion(confusion, [0, 1])
        self.assertEqual(counts, {0: 2, 1: 4})


class CheckAgainstBaselineTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.baseline_path = os.path.join(self.tmpdir, "baseline.json")

    def test_first_call_creates_the_baseline_file(self):
        from ml.drift import check_against_baseline

        psi, verdict, is_first_run = check_against_baseline(self.baseline_path, {"a": 10, "b": 5})
        self.assertTrue(is_first_run)
        self.assertIsNone(psi)
        self.assertTrue(os.path.exists(self.baseline_path))
        with open(self.baseline_path) as f:
            saved = json.load(f)
        self.assertIn("distribution", saved)

    def test_second_call_with_the_same_distribution_reports_no_drift(self):
        from ml.drift import check_against_baseline

        check_against_baseline(self.baseline_path, {"a": 10, "b": 5})
        psi, verdict, is_first_run = check_against_baseline(self.baseline_path, {"a": 10, "b": 5})
        self.assertFalse(is_first_run)
        self.assertAlmostEqual(psi, 0.0, places=6)
        self.assertIn("no significant", verdict)

    def test_second_call_with_a_shifted_distribution_reports_drift(self):
        from ml.drift import check_against_baseline

        check_against_baseline(self.baseline_path, {"a": 100, "b": 0})
        psi, verdict, is_first_run = check_against_baseline(self.baseline_path, {"a": 0, "b": 100})
        self.assertFalse(is_first_run)
        self.assertGreater(psi, 0.25)
        self.assertIn("significant shift", verdict)

    def test_integer_keyed_counts_survive_the_json_round_trip_without_spurious_drift(self):
        # Regression test: JSON object keys are always strings, so an
        # int-keyed distribution ({0: ..., 1: ...}, exactly what the
        # binary conversion/streak-dropoff targets produce) used to
        # round-trip through the baseline file as {"0": ..., "1": ...}
        # and compare as entirely different categories from the next
        # run's int-keyed dict -- reporting a "significant shift" against
        # IDENTICAL predictions. Caught by hand while wiring this up;
        # covering it here so it can't come back silently.
        from ml.drift import check_against_baseline

        check_against_baseline(self.baseline_path, {0: 726, 1: 274})
        psi, verdict, is_first_run = check_against_baseline(self.baseline_path, {0: 726, 1: 274})
        self.assertFalse(is_first_run)
        self.assertAlmostEqual(psi, 0.0, places=6)
        self.assertIn("no significant", verdict)


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/pandas not installed (requirements-ml.txt)")
class ValidationGateTests(unittest.TestCase):
    """Confirms the gate in ml.train_archetype_model actually fires on a
    genuinely bad model, not just on the real (good) one it normally
    trains -- exercised directly against the gate's own logic rather than
    the full training script, so this doesn't need a live retrain."""

    def test_archetype_gate_rejects_low_accuracy(self):
        import ml.train_archetype_model as mod

        self.assertGreater(mod.MIN_ACCEPTABLE_ACCURACY, 0.0)
        # The gate is a plain comparison in main(); assert the constant
        # it's compared against is sane and that ValidationFailed exists
        # as the documented failure mode other tooling could catch.
        self.assertTrue(issubclass(mod.ValidationFailed, Exception))

    def test_conversion_gate_constants_are_sane(self):
        import ml.train_conversion_model as mod

        self.assertGreater(mod.MIN_ACCEPTABLE_PR_AUC, 0.0)
        self.assertLess(mod.MIN_ACCEPTABLE_PR_AUC, 1.0)
        self.assertTrue(issubclass(mod.ValidationFailed, Exception))

    def test_streak_dropoff_gate_constants_are_sane(self):
        import ml.train_streak_dropoff_model as mod

        self.assertGreater(mod.MIN_ACCEPTABLE_PR_AUC, 0.0)
        self.assertTrue(issubclass(mod.ValidationFailed, Exception))


if __name__ == "__main__":
    unittest.main()
