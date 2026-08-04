"""
Shared train/evaluate machinery for both predictive-model targets: a
logistic-regression baseline, then XGBoost compared against it, evaluated
on precision/recall/PR-AUC (not raw accuracy — both targets are imbalanced
by construction: most users don't convert, most streaks don't drop), with
feature importance extracted from both models.

Deliberately one shared module rather than two copies: the mechanics
(stratified split, class-imbalance handling, which metrics to report, how
to extract importance) are identical for both targets — only the feature
set and target column differ, which the caller supplies.
"""

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier


@dataclass
class ModelReport:
    model_name: str
    precision: float
    recall: float
    f1: float
    pr_auc: float
    roc_auc: float
    confusion: list  # [[tn, fp], [fn, tp]]
    feature_importance: dict = field(default_factory=dict)  # feature -> signed or unsigned importance

    def summary_line(self):
        return (
            f"{self.model_name:20s} precision={self.precision:.3f} recall={self.recall:.3f} "
            f"f1={self.f1:.3f} PR-AUC={self.pr_auc:.3f} ROC-AUC={self.roc_auc:.3f}"
        )


def _evaluate(name, y_true, y_pred, y_prob, feature_importance):
    precision, recall, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
    cm = confusion_matrix(y_true, y_pred).tolist()
    pr_auc = average_precision_score(y_true, y_prob)
    roc_auc = roc_auc_score(y_true, y_prob) if len(set(y_true)) > 1 else float("nan")
    return ModelReport(name, precision, recall, f1, pr_auc, roc_auc, cm, feature_importance)


def train_and_evaluate(df: pd.DataFrame, feature_cols: list, target_col: str, test_size=0.25, random_state=42):
    """Returns (logistic_report, xgboost_report). Both trained on the same
    stratified split so their metrics are directly comparable."""
    X = df[feature_cols].to_numpy(dtype=float)
    y = df[target_col].to_numpy(dtype=int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    # --- Baseline: logistic regression ------------------------------------
    # class_weight="balanced" instead of resampling: reweights the loss
    # rather than duplicating/discarding rows, which keeps the reported
    # test-set class balance representative of the real (imbalanced)
    # population instead of an artificially rebalanced one.
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    lr = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=random_state)
    lr.fit(X_train_scaled, y_train)
    lr_pred = lr.predict(X_test_scaled)
    lr_prob = lr.predict_proba(X_test_scaled)[:, 1]
    # Coefficients are on standardized features, so they're directly
    # comparable to each other (a bigger |coefficient| means a bigger
    # effect per standard deviation of that feature, not an artifact of
    # the feature's raw scale/units).
    lr_importance = dict(zip(feature_cols, lr.coef_[0].tolist()))

    lr_report = _evaluate("LogisticRegression", y_test, lr_pred, lr_prob, lr_importance)

    # --- XGBoost -------------------------------------------------------
    pos = max(1, int(y_train.sum()))
    neg = max(1, len(y_train) - int(y_train.sum()))
    xgb = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        scale_pos_weight=neg / pos,  # same intent as class_weight="balanced" above, XGBoost's own mechanism
        eval_metric="aucpr",
        random_state=random_state,
    )
    xgb.fit(X_train, y_train)
    xgb_pred = xgb.predict(X_test)
    xgb_prob = xgb.predict_proba(X_test)[:, 1]
    xgb_importance = dict(zip(feature_cols, xgb.feature_importances_.tolist()))

    xgb_report = _evaluate("XGBoost", y_test, xgb_pred, xgb_prob, xgb_importance)

    return lr_report, xgb_report


def print_report(target_name, df, feature_cols, lr_report, xgb_report):
    print(f"\n{'=' * 78}\n{target_name}\n{'=' * 78}")
    print(f"n={len(df)}  positive rate={df[df.columns[-1]].mean():.3f}  features={feature_cols}")
    print()
    for report in (lr_report, xgb_report):
        print(report.summary_line())
        tn, fp = report.confusion[0]
        fn, tp = report.confusion[1]
        print(f"    confusion matrix: TN={tn} FP={fp} FN={fn} TP={tp}")
        ranked = sorted(report.feature_importance.items(), key=lambda kv: abs(kv[1]), reverse=True)
        print("    feature importance (ranked):")
        for feat, val in ranked:
            print(f"      {feat:32s} {val:+.4f}")
        print()
