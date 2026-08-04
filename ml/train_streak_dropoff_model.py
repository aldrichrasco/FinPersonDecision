"""
Streak-drop-off model: binary, predicted from streak/XP snapshot and days
since last activity — see ml/features.py's docstring on why this is a
snapshot-based proxy rather than a true time-to-event model (no streak
*history* is stored under the current schema, only current state).

Same real-first/synthetic-fallback pattern as train_conversion_model.py.

Run: python -m ml.train_streak_dropoff_model
"""

from ml.features import build_streak_dropoff_dataset, data_quality_report
from ml.pipeline import print_report, train_and_evaluate
from ml.synthetic import synthetic_streak_dropoff_dataset

FEATURE_COLS = ["streak_at_snapshot", "xp_at_snapshot", "lessons_completed", "today_xp", "days_inactive"]
TARGET_COL = "dropped_off"


def main():
    real_df = build_streak_dropoff_dataset()
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
        df = synthetic_streak_dropoff_dataset()
        source = "SYNTHETIC data (designed relationship, NOT a real-world finding)"

    lr_report, xgb_report = train_and_evaluate(df, FEATURE_COLS, TARGET_COL)
    print_report(f"Streak drop-off — {source}", df, FEATURE_COLS, lr_report, xgb_report)
    return lr_report, xgb_report, source


if __name__ == "__main__":
    main()
