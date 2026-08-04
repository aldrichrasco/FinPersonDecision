"""
Archetype matcher rebuild: empirical clustering (k-means vs. hierarchical,
scored by silhouette) + a supervised classifier (logistic regression
baseline, then random forest), checked against fbm.js's 11 hand-defined
archetypes.

Same real-first/synthetic-fallback pattern as ml/train_conversion_model.py
and ml/train_streak_dropoff_model.py — see ml/archetype_synthetic.py's
docstring for why this currently runs on synthetic data (101 real saved
profiles exist, covering 4 of 11 archetypes, one down to a single example
— not trainable and not clusterable).

Saves the trained random-forest classifier + metadata to ml/artifacts/ —
NOT wired into server.py's live matching by default (see the "product
wiring" note this script prints). That stays fbm.js's real nearest-
neighbor matcher until this is trained on real quiz responses instead of
a synthetic population sampled around fbm.js's own hand-tuned centroids.

Run: python -m ml.train_archetype_model
"""

import json
import os
import time

from ml.archetype_classifier import print_classifier_report, train_and_evaluate
from ml.archetype_clustering import best_k, match_clusters_to_archetypes, run_hierarchical, run_kmeans, sweep_kmeans
from ml.archetype_data import build_archetype_dataset
from ml.archetype_synthetic import load_archetype_profiles, synthetic_archetype_dataset
from ml.features import data_quality_report

ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")


def main():
    axis_keys, archetype_profiles = load_archetype_profiles()
    hand_defined_count = len(archetype_profiles)

    real_df = build_archetype_dataset()
    usable, reason, stats = data_quality_report(real_df, "archetype", min_per_class=20)
    print(f"Real data pull: {stats}")
    if usable:
        print("Real data is trainable — using it.")
        df = real_df
        source = "REAL quiz response data"
    else:
        print(f"Real data NOT usable ({reason}).")
        print("Falling back to a SYNTHETIC population sampled around fbm.js's own 11 hand-tuned")
        print("archetype centroids (see ml/archetype_synthetic.py) — this validates the clustering")
        print("and classification pipeline, and asks a real question (do these 11 hand-designed")
        print("centroids come back out of empirical clustering?), but is NOT a claim about real users.")
        df = synthetic_archetype_dataset()
        source = "SYNTHETIC population (sampled around fbm.js's hand-tuned centroids)"

    X = df[axis_keys]

    # --- 1. Empirical clustering ------------------------------------------
    print(f"\n{'=' * 78}\n1. Empirical clustering — {source}\n{'=' * 78}")
    sweep = sweep_kmeans(X)
    print(sweep.to_string(index=False))
    k_star = best_k(sweep)
    print(f"\nBest k by silhouette: {k_star}  (hand-defined archetype count: {hand_defined_count})")

    labels_km, centers_km, sil_km = run_kmeans(X, k_star)
    print(f"k-means @ k={k_star}: silhouette={sil_km:.3f}")

    labels_hc, centers_hc, sil_hc = run_hierarchical(X, hand_defined_count)
    print(f"hierarchical @ k={hand_defined_count} (forced to match hand-defined count): silhouette={sil_hc:.3f}")

    print(f"\n2. Empirical clusters (k={k_star}, k-means) matched to nearest hand-defined archetype:")
    matches = match_clusters_to_archetypes(centers_km, axis_keys, archetype_profiles)
    matched_archetypes = {}
    for cluster_idx, archetype, dist in matches:
        print(f"   cluster {cluster_idx} -> {archetype}  (distance={dist:.1f})")
        matched_archetypes.setdefault(archetype, []).append(cluster_idx)

    unmatched = set(archetype_profiles.keys()) - set(matched_archetypes.keys())
    merged = {a: c for a, c in matched_archetypes.items() if len(c) > 1}
    print(f"\n   Hand-defined archetypes with NO matching empirical cluster (k={k_star}): "
          f"{sorted(unmatched) or 'none'}")
    print(f"   Hand-defined archetypes matched by MULTIPLE clusters (possible over-segmentation "
          f"at this k, or the archetype is genuinely broader than one empirical group): "
          f"{merged or 'none'}")
    if k_star != hand_defined_count:
        print(f"\n   NOTE: silhouette prefers k={k_star}, not the hand-defined {hand_defined_count}. "
              f"On this population that's expected — see ML_ENGINEERING_NOTES.md for the reading.")

    # --- 2. Supervised classifier ------------------------------------------
    print(f"\n{'=' * 78}\n3. Supervised classifier (predicts archetype from the 6-axis profile) — {source}\n{'=' * 78}")
    lr_report, rf_report, rf_model = train_and_evaluate(df, axis_keys)
    print_classifier_report(lr_report)
    print()
    print_classifier_report(rf_report)

    # --- 3. Save artifact (sets up ML_ENGINEERING_NOTES.md item 4: MLOps) --
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    import joblib

    timestamp = int(time.time())
    model_path = os.path.join(ARTIFACT_DIR, f"archetype_rf_{timestamp}.joblib")
    joblib.dump(rf_model, model_path)
    metadata = {
        "trained_at": timestamp,
        "data_source": source,
        "n_rows": len(df),
        "axis_keys": axis_keys,
        "class_labels": rf_report.labels,
        "rf_accuracy": rf_report.accuracy,
        "lr_accuracy": lr_report.accuracy,
        "silhouette_best_k": k_star,
        "silhouette_best_score": float(sweep["silhouette"].max()),
        "model_path": os.path.basename(model_path),
    }
    metadata_path = os.path.join(ARTIFACT_DIR, f"archetype_rf_{timestamp}.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"\nSaved model artifact: {model_path}")
    print(f"Saved metadata: {metadata_path}")

    print(
        "\nProduct wiring: NOT live. server.py's actual archetype matching stays fbm.js's "
        "nearest-neighbor matchArchetype() — this classifier is trained on synthetic data and "
        "wiring it into production would present a synthetic-data model as a real one. See "
        "ML_ENGINEERING_NOTES.md §3."
    )
    return lr_report, rf_report, metadata


if __name__ == "__main__":
    main()
