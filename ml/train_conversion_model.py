"""
Pro-conversion-likelihood model: binary, predicted from early-window
(first 7 days) behavioral signals.

Pulls real features first (ml.features.build_conversion_dataset), checks
whether the pull is actually trainable (ml.features.data_quality_report —
not just a row count, see that function's docstring for why), and only
falls back to the synthetic, designed-relationship dataset
(ml.synthetic.synthetic_conversion_dataset) if it isn't. Prints which one
ran and why, every time — this must never be ambiguous from the output.

Same versioned-artifact / drift-check / validation-gate pattern as
ml.train_archetype_model — see that module for the fuller explanation.

Run: python -m ml.train_conversion_model
"""

import json
import os
import time

from ml.drift import check_against_baseline, predicted_counts_from_confusion
from ml.features import CONVERSION_WINDOW_DAYS, build_conversion_dataset, data_quality_report
from ml.pipeline import print_report, train_and_evaluate
from ml.synthetic import synthetic_conversion_dataset

FEATURE_COLS = [
    "early_decision_count", "early_distinct_days_active", "early_mean_wellbeing",
    "early_characteristic_drift_rate", "first_decision_day",
]
TARGET_COL = "converted"

ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
BASELINE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "baselines")
BASELINE_PATH = os.path.join(BASELINE_DIR, "conversion_baseline_distribution.json")
MIN_ACCEPTABLE_PR_AUC = 0.15  # no-skill baseline is the positive rate (~0.15 on synthetic); this is a floor, not a target
MAX_ACCEPTABLE_PSI = 0.25


class ValidationFailed(Exception):
    pass


def main():
    real_df = build_conversion_dataset(window_days=CONVERSION_WINDOW_DAYS)
    usable, reason, stats = data_quality_report(real_df, TARGET_COL)

    print(f"Real data pull: {stats}")
    if usable:
        print("Real data is trainable — using it.")
        df = real_df
        source = "REAL product data"
    else:
        print(f"Real data NOT usable ({reason}).")
        print("Falling back to a SYNTHETIC dataset with a designed, documented feature->target")
        print("relationship (see ml/synthetic.py) to validate the pipeline mechanics instead.")
        df = synthetic_conversion_dataset()
        source = "SYNTHETIC data (designed relationship, NOT a real-world finding)"

    lr_report, xgb_report = train_and_evaluate(df, FEATURE_COLS, TARGET_COL)
    print_report(f"Pro conversion likelihood — {source}", df, FEATURE_COLS, lr_report, xgb_report)

    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    predicted_counts = predicted_counts_from_confusion(xgb_report.confusion, [0, 1])
    psi, verdict, is_first_run = check_against_baseline(BASELINE_PATH, predicted_counts, label="predicted conversion distribution")
    if is_first_run:
        print(f"\nDrift check: {verdict}")

    import joblib

    timestamp = int(time.time())
    model_path = os.path.join(ARTIFACT_DIR, f"conversion_xgb_{timestamp}.joblib")
    # train_and_evaluate doesn't currently return the fitted xgboost model
    # object itself (only its report) — retrain the winning model once more
    # on the full dataset for the artifact, same hyperparameters, so what's
    # persisted matches what was evaluated rather than being a second,
    # differently-configured model.
    from xgboost import XGBClassifier

    pos = max(1, int(df[TARGET_COL].sum()))
    neg = max(1, len(df) - pos)
    final_model = XGBClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.08,
        scale_pos_weight=neg / pos, eval_metric="aucpr", random_state=42,
    )
    final_model.fit(df[FEATURE_COLS].to_numpy(dtype=float), df[TARGET_COL].to_numpy(dtype=int))
    joblib.dump(final_model, model_path)

    metadata = {
        "trained_at": timestamp,
        "data_source": source,
        "n_rows": len(df),
        "feature_cols": FEATURE_COLS,
        "lr_pr_auc": lr_report.pr_auc,
        "xgb_pr_auc": xgb_report.pr_auc,
        "model_path": os.path.basename(model_path),
        "drift_psi": psi,
        "drift_verdict": verdict,
    }
    metadata_path = os.path.join(ARTIFACT_DIR, f"conversion_xgb_{timestamp}.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"\nSaved model artifact: {model_path}")
    print(f"Saved metadata: {metadata_path}")

    print(
        "\nProduct wiring: OFFLINE ANALYSIS ONLY. No operator-facing churn/conversion flag is wired "
        "into the product — see ML_ENGINEERING_NOTES.md §2."
    )

    if xgb_report.pr_auc < MIN_ACCEPTABLE_PR_AUC:
        raise ValidationFailed(f"XGBoost PR-AUC {xgb_report.pr_auc:.3f} is below the {MIN_ACCEPTABLE_PR_AUC} floor.")
    if psi is not None and psi > MAX_ACCEPTABLE_PSI:
        raise ValidationFailed(f"predicted-distribution PSI {psi:.3f} exceeds the {MAX_ACCEPTABLE_PSI} threshold.")
    print(f"\nValidation gate: PASSED (PR-AUC={xgb_report.pr_auc:.3f} >= {MIN_ACCEPTABLE_PR_AUC}, "
          f"PSI={'n/a (first run)' if psi is None else f'{psi:.3f} <= {MAX_ACCEPTABLE_PSI}'})")

    return lr_report, xgb_report, source


if __name__ == "__main__":
    main()
