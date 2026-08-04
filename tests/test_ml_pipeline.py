"""
Tests for ml/ — the predictive models on product data (Pro conversion
likelihood, streak drop-off).

CI only installs requirements.txt, not requirements-ml.txt — sklearn/
xgboost/pandas are NOT guaranteed to be present. Everything here is
skip-guarded on their availability.
"""

import importlib.util
import unittest

_HAS_ML_DEPS = all(
    importlib.util.find_spec(pkg) is not None for pkg in ("sklearn", "xgboost", "pandas")
)


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/xgboost/pandas not installed (requirements-ml.txt)")
class SyntheticDatasetTests(unittest.TestCase):
    def test_conversion_dataset_shape_and_balance(self):
        from ml.synthetic import synthetic_conversion_dataset

        df = synthetic_conversion_dataset(n=500, seed=1)
        self.assertEqual(len(df), 500)
        self.assertEqual(
            set(df.columns),
            {"early_decision_count", "early_distinct_days_active", "early_mean_wellbeing",
             "early_characteristic_drift_rate", "first_decision_day", "converted"},
        )
        # A real imbalance, not degenerate (all-0 or all-1) or artificially 50/50.
        rate = df["converted"].mean()
        self.assertGreater(rate, 0.0)
        self.assertLess(rate, 0.5)

    def test_conversion_dataset_is_deterministic_for_a_given_seed(self):
        from ml.synthetic import synthetic_conversion_dataset

        a = synthetic_conversion_dataset(n=200, seed=7)
        b = synthetic_conversion_dataset(n=200, seed=7)
        self.assertTrue((a["converted"] == b["converted"]).all())

    def test_streak_dropoff_dataset_shape_and_balance(self):
        from ml.synthetic import synthetic_streak_dropoff_dataset

        df = synthetic_streak_dropoff_dataset(n=500, seed=2)
        self.assertEqual(len(df), 500)
        self.assertEqual(
            set(df.columns),
            {"streak_at_snapshot", "xp_at_snapshot", "lessons_completed", "today_xp",
             "days_inactive", "dropped_off"},
        )
        rate = df["dropped_off"].mean()
        self.assertGreater(rate, 0.0)
        self.assertLess(rate, 0.5)


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/xgboost/pandas not installed (requirements-ml.txt)")
class PipelineTests(unittest.TestCase):
    """Exercises the shared train/evaluate machinery directly against a
    synthetic dataset with a KNOWN relationship — the thing worth testing
    here is that the pipeline correctly recovers a signal that's genuinely
    present, not what any particular real-world number should be."""

    @classmethod
    def setUpClass(cls):
        from ml.pipeline import train_and_evaluate
        from ml.synthetic import synthetic_conversion_dataset

        cls.feature_cols = [
            "early_decision_count", "early_distinct_days_active", "early_mean_wellbeing",
            "early_characteristic_drift_rate", "first_decision_day",
        ]
        cls.df = synthetic_conversion_dataset(n=3000, seed=42)
        cls.lr_report, cls.xgb_report = train_and_evaluate(cls.df, cls.feature_cols, "converted")

    def test_metrics_are_in_valid_ranges(self):
        for report in (self.lr_report, self.xgb_report):
            for value in (report.precision, report.recall, report.f1, report.pr_auc, report.roc_auc):
                self.assertGreaterEqual(value, 0.0)
                self.assertLessEqual(value, 1.0)

    def test_pr_auc_beats_the_no_skill_baseline(self):
        # The no-skill baseline for PR-AUC is the positive rate itself (a
        # model that ignores the features entirely). Both real models
        # should clear it by a wide margin on a dataset with a genuine,
        # designed signal -- if this ever fails, something in the pipeline
        # (not the data) is broken.
        positive_rate = self.df["converted"].mean()
        self.assertGreater(self.lr_report.pr_auc, positive_rate * 1.5)
        self.assertGreater(self.xgb_report.pr_auc, positive_rate * 1.5)

    def test_confusion_matrix_shape_and_totals(self):
        expected_test_size = round(len(self.df) * 0.25)  # default test_size in train_and_evaluate
        for report in (self.lr_report, self.xgb_report):
            self.assertEqual(len(report.confusion), 2)
            self.assertEqual(len(report.confusion[0]), 2)
            total = sum(sum(row) for row in report.confusion)
            self.assertEqual(total, expected_test_size)

    def test_feature_importance_covers_every_feature(self):
        for report in (self.lr_report, self.xgb_report):
            self.assertEqual(set(report.feature_importance.keys()), set(self.feature_cols))

    def test_pipeline_recovers_the_dominant_designed_feature(self):
        # synthetic_conversion_dataset's docstring: early_decision_count and
        # first_decision_day are the two largest-magnitude terms in the
        # designed logit. Both models should rank at least one of them at
        # or near the top -- a weak proxy for "the pipeline finds real
        # signal," not a claim about what real users actually do.
        top_feature_lr = max(self.lr_report.feature_importance, key=lambda k: abs(self.lr_report.feature_importance[k]))
        top_feature_xgb = max(self.xgb_report.feature_importance, key=lambda k: abs(self.xgb_report.feature_importance[k]))
        strong_signal_features = {"early_decision_count", "first_decision_day", "early_distinct_days_active"}
        self.assertIn(top_feature_lr, strong_signal_features)
        self.assertIn(top_feature_xgb, strong_signal_features)


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/xgboost/pandas not installed (requirements-ml.txt)")
class RealFeatureEngineeringTests(unittest.TestCase):
    """These run the REAL SQL feature-engineering queries (ml/features.py)
    against whatever's actually in the local database -- proving the query
    logic itself is correct, independent of whether the current data is
    trainable (it isn't, see data_quality_report below)."""

    def test_conversion_dataset_runs_and_has_expected_shape(self):
        from ml.features import build_conversion_dataset

        df = build_conversion_dataset()
        self.assertEqual(
            set(df.columns),
            {"user_id", "early_decision_count", "early_distinct_days_active", "early_mean_wellbeing",
             "early_characteristic_drift_rate", "first_decision_day", "converted"},
        )
        self.assertTrue(df["converted"].isin([0, 1]).all())

    def test_streak_dropoff_dataset_runs_and_has_expected_shape(self):
        from ml.features import build_streak_dropoff_dataset

        df = build_streak_dropoff_dataset()
        self.assertEqual(
            list(df.columns),
            ["user_id", "streak_at_snapshot", "xp_at_snapshot", "lessons_completed",
             "today_xp", "days_inactive", "dropped_off"],
        )

    def test_data_quality_report_flags_the_current_database_as_unusable(self):
        # As of this test's writing, 2,368 of 2,369 users in the local
        # database are @example.com pytest fixtures accumulated across test
        # runs -- this asserts the honesty check actually catches that,
        # not a specific row count that would break as more tests run.
        from ml.features import build_conversion_dataset, data_quality_report

        df = build_conversion_dataset()
        usable, reason, stats = data_quality_report(df, "converted")
        self.assertFalse(usable)
        self.assertIn("test-fixture", reason)

    def test_data_quality_report_accepts_a_clean_synthetic_frame(self):
        from ml.features import data_quality_report
        from ml.synthetic import synthetic_conversion_dataset

        df = synthetic_conversion_dataset(n=500, seed=1)  # no user_id column -> skips the fixture check
        usable, reason, stats = data_quality_report(df, "converted")
        self.assertTrue(usable, reason)


if __name__ == "__main__":
    unittest.main()
