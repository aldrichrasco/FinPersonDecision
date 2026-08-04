"""
Tests for the archetype matcher rebuild (ml/archetype_*.py) — clustering,
supervised classification, and artifact serving.

CI only installs requirements.txt, not requirements-ml.txt — everything
here is skip-guarded on scikit-learn/pandas/joblib availability.
"""

import importlib.util
import os
import shutil
import tempfile
import unittest
import unittest.mock

_HAS_ML_DEPS = all(
    importlib.util.find_spec(pkg) is not None for pkg in ("sklearn", "pandas", "joblib")
)


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/pandas/joblib not installed (requirements-ml.txt)")
class SyntheticArchetypePopulationTests(unittest.TestCase):
    def test_covers_all_eleven_archetypes(self):
        from ml.archetype_synthetic import load_archetype_profiles, synthetic_archetype_dataset

        _, profiles = load_archetype_profiles()
        df = synthetic_archetype_dataset(n_per_archetype=20, seed=1)
        self.assertEqual(set(df["archetype"].unique()), set(profiles.keys()))
        self.assertEqual(len(df), 20 * len(profiles))

    def test_axis_values_stay_in_range(self):
        from ml.archetype_synthetic import load_archetype_profiles, synthetic_archetype_dataset

        axis_keys, _ = load_archetype_profiles()
        df = synthetic_archetype_dataset(n_per_archetype=50, seed=2)
        for axis in axis_keys:
            self.assertTrue((df[axis] >= 0).all())
            self.assertTrue((df[axis] <= 100).all())

    def test_deterministic_for_a_given_seed(self):
        from ml.archetype_synthetic import synthetic_archetype_dataset

        a = synthetic_archetype_dataset(n_per_archetype=10, seed=9)
        b = synthetic_archetype_dataset(n_per_archetype=10, seed=9)
        self.assertTrue((a["impulse_regulation"] == b["impulse_regulation"]).all())


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/pandas/joblib not installed (requirements-ml.txt)")
class ClusteringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from ml.archetype_synthetic import load_archetype_profiles, synthetic_archetype_dataset

        cls.axis_keys, cls.profiles = load_archetype_profiles()
        cls.df = synthetic_archetype_dataset(n_per_archetype=60, seed=42)
        cls.X = cls.df[cls.axis_keys]

    def test_kmeans_sweep_returns_a_row_per_k(self):
        from ml.archetype_clustering import sweep_kmeans

        sweep = sweep_kmeans(self.X, k_range=range(2, 6))
        self.assertEqual(list(sweep["k"]), [2, 3, 4, 5])
        self.assertTrue((sweep["silhouette"] <= 1.0).all())
        self.assertTrue((sweep["silhouette"] >= -1.0).all())

    def test_kmeans_at_the_true_k_separates_well_above_chance(self):
        # This population is Gaussian around 11 well-separated (by design)
        # centroids, so k-means at the true k=11 should find real
        # structure, not noise -- a silhouette near 0 here would mean the
        # clustering code itself is broken, not that real users are messy.
        from ml.archetype_clustering import run_kmeans

        _, _, silhouette = run_kmeans(self.X, k=11)
        self.assertGreater(silhouette, 0.15)

    def test_cluster_to_archetype_matching_returns_one_row_per_cluster(self):
        from ml.archetype_clustering import match_clusters_to_archetypes, run_kmeans

        _, centers, _ = run_kmeans(self.X, k=11)
        matches = match_clusters_to_archetypes(centers, self.axis_keys, self.profiles)
        self.assertEqual(len(matches), 11)
        for cluster_idx, archetype, dist in matches:
            self.assertIn(archetype, self.profiles)
            self.assertGreaterEqual(dist, 0)

    def test_matching_recovers_most_archetypes_at_the_true_k(self):
        # Not all 11 necessarily come back distinct (that's a real,
        # documented finding at the noise level used by default -- see
        # ML_ENGINEERING_NOTES.md) but at k=11 with this test's fixture the
        # large majority should, which is what proves the matching logic
        # itself is doing its job.
        from ml.archetype_clustering import match_clusters_to_archetypes, run_kmeans

        _, centers, _ = run_kmeans(self.X, k=11)
        matches = match_clusters_to_archetypes(centers, self.axis_keys, self.profiles)
        matched_archetypes = {archetype for _, archetype, _ in matches}
        self.assertGreaterEqual(len(matched_archetypes), 8)


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/pandas/joblib not installed (requirements-ml.txt)")
class ArchetypeClassifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from ml.archetype_classifier import train_and_evaluate
        from ml.archetype_synthetic import load_archetype_profiles, synthetic_archetype_dataset

        cls.axis_keys, cls.profiles = load_archetype_profiles()
        cls.df = synthetic_archetype_dataset(n_per_archetype=100, seed=42)
        cls.lr_report, cls.rf_report, cls.rf_model = train_and_evaluate(cls.df, cls.axis_keys)

    def test_accuracy_beats_random_guessing_by_a_wide_margin(self):
        chance = 1 / len(self.profiles)
        self.assertGreater(self.lr_report.accuracy, chance * 3)
        self.assertGreater(self.rf_report.accuracy, chance * 3)

    def test_confusion_matrix_is_square_and_covers_all_classes(self):
        for report in (self.lr_report, self.rf_report):
            self.assertEqual(len(report.labels), len(self.profiles))
            self.assertEqual(len(report.confusion), len(self.profiles))
            self.assertTrue(all(len(row) == len(self.profiles) for row in report.confusion))

    def test_feature_importance_covers_every_axis(self):
        for report in (self.lr_report, self.rf_report):
            self.assertEqual(set(report.feature_importance.keys()), set(self.axis_keys))

    def test_rf_model_is_a_fitted_sklearn_classifier(self):
        # Returned separately from the report so it can be persisted --
        # confirms it's actually the fitted model, not something else.
        preds = self.rf_model.predict(self.df[self.axis_keys].to_numpy())
        self.assertEqual(len(preds), len(self.df))


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/pandas/joblib not installed (requirements-ml.txt)")
class ServingTests(unittest.TestCase):
    """Trains a tiny real artifact into a temp directory and round-trips it
    through ml.serve_archetype.predict() -- proving the saved format is
    actually loadable and usable, not just writable."""

    def setUp(self):
        import ml.serve_archetype as serving

        self.tmpdir = tempfile.mkdtemp()
        self.patcher = unittest.mock.patch.object(serving, "ARTIFACT_DIR", self.tmpdir)
        self.patcher.start()

    def tearDown(self):
        self.patcher.stop()
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_no_artifact_raises_a_clear_error(self):
        import ml.serve_archetype as serving

        with self.assertRaises(serving.NoArtifact):
            serving.predict({})

    def test_predict_round_trips_through_a_freshly_trained_artifact(self):
        import json

        import joblib

        from ml.archetype_classifier import train_and_evaluate
        from ml.archetype_synthetic import load_archetype_profiles, synthetic_archetype_dataset
        import ml.serve_archetype as serving

        axis_keys, profiles = load_archetype_profiles()
        df = synthetic_archetype_dataset(n_per_archetype=40, seed=5)
        _, rf_report, rf_model = train_and_evaluate(df, axis_keys)

        model_path = os.path.join(self.tmpdir, "archetype_rf_123.joblib")
        joblib.dump(rf_model, model_path)
        with open(os.path.join(self.tmpdir, "archetype_rf_123.json"), "w", encoding="utf-8") as f:
            json.dump({"axis_keys": axis_keys, "model_path": "archetype_rf_123.joblib"}, f)

        target_archetype = next(iter(profiles))
        result = serving.predict(profiles[target_archetype])
        self.assertIn(result["archetype"], profiles)
        self.assertAlmostEqual(sum(result["probabilities"].values()), 1.0, places=5)

    def test_predict_rejects_a_profile_missing_axes(self):
        import json

        import joblib

        from ml.archetype_classifier import train_and_evaluate
        from ml.archetype_synthetic import load_archetype_profiles, synthetic_archetype_dataset
        import ml.serve_archetype as serving

        axis_keys, _ = load_archetype_profiles()
        df = synthetic_archetype_dataset(n_per_archetype=20, seed=6)
        _, _, rf_model = train_and_evaluate(df, axis_keys)
        model_path = os.path.join(self.tmpdir, "archetype_rf_456.joblib")
        joblib.dump(rf_model, model_path)
        with open(os.path.join(self.tmpdir, "archetype_rf_456.json"), "w", encoding="utf-8") as f:
            json.dump({"axis_keys": axis_keys, "model_path": "archetype_rf_456.joblib"}, f)

        with self.assertRaises(ValueError):
            serving.predict({"impulse_regulation": 50})


@unittest.skipUnless(_HAS_ML_DEPS, "scikit-learn/pandas/joblib not installed (requirements-ml.txt)")
class RealArchetypeDataTests(unittest.TestCase):
    def test_real_pull_runs_and_has_expected_shape(self):
        from ml.archetype_data import AXIS_KEYS, build_archetype_dataset

        df = build_archetype_dataset()
        self.assertEqual(list(df.columns), ["user_id", *AXIS_KEYS, "archetype"])

    def test_quality_gate_flags_the_current_database(self):
        # As of this test's writing, the local database has 101 saved
        # profiles covering only 4 of 11 archetypes -- this checks the
        # gate actually catches that shape of insufficiency (missing
        # classes), not a specific row count that'll drift as tests run.
        from ml.archetype_data import build_archetype_dataset
        from ml.features import data_quality_report

        df = build_archetype_dataset()
        usable, reason, stats = data_quality_report(df, "archetype", min_per_class=20)
        self.assertFalse(usable)


if __name__ == "__main__":
    unittest.main()
