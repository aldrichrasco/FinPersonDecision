"""
Pro-conversion-likelihood model: binary, predicted from early-window
(first 7 days) behavioral signals.

Pulls real features first (ml.features.build_conversion_dataset), checks
whether the pull is actually trainable (ml.features.data_quality_report —
not just a row count, see that function's docstring for why), and only
falls back to the synthetic, designed-relationship dataset
(ml.synthetic.synthetic_conversion_dataset) if it isn't. Prints which one
ran and why, every time — this must never be ambiguous from the output.

Run: python -m ml.train_conversion_model
"""

from ml.features import CONVERSION_WINDOW_DAYS, build_conversion_dataset, data_quality_report
from ml.pipeline import print_report, train_and_evaluate
from ml.synthetic import synthetic_conversion_dataset

FEATURE_COLS = [
    "early_decision_count", "early_distinct_days_active", "early_mean_wellbeing",
    "early_characteristic_drift_rate", "first_decision_day",
]
TARGET_COL = "converted"


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
    return lr_report, xgb_report, source


if __name__ == "__main__":
    main()
