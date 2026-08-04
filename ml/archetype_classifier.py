"""
Supervised archetype classifier: predicts archetype label from the six-axis
profile. Logistic regression baseline first, then random forest, held-out
test set, accuracy + full confusion matrix — this is what would replace
fbm.js's hand-written nearest-neighbor matchAtchetype() if/when it's
trained on real data (see ml/train_archetype_model.py for the honest
current status: synthetic data only, not wired into production).
"""

from dataclasses import dataclass, field

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler


@dataclass
class ClassifierReport:
    model_name: str
    accuracy: float
    labels: list
    confusion: list  # len(labels) x len(labels), rows=true, cols=predicted
    feature_importance: dict = field(default_factory=dict)

    def summary_line(self):
        return f"{self.model_name:20s} accuracy={self.accuracy:.3f}  (n_classes={len(self.labels)})"


def train_and_evaluate(df, axis_keys, target_col="archetype", test_size=0.25, random_state=42):
    X = df[axis_keys].to_numpy(dtype=float)
    y = df[target_col].to_numpy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    labels = sorted(set(y))

    # --- Baseline: multinomial logistic regression --------------------
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    lr = LogisticRegression(max_iter=2000, random_state=random_state)
    lr.fit(X_train_scaled, y_train)
    lr_pred = lr.predict(X_test_scaled)
    # Mean absolute standardized coefficient across classes — a rough,
    # single-number-per-feature summary for a multiclass model where each
    # class has its own coefficient vector.
    lr_importance = dict(zip(axis_keys, np.mean(np.abs(lr.coef_), axis=0).tolist()))
    lr_report = ClassifierReport(
        "LogisticRegression", accuracy_score(y_test, lr_pred), labels,
        confusion_matrix(y_test, lr_pred, labels=labels).tolist(), lr_importance,
    )

    # --- Random forest ---------------------------------------------------
    rf = RandomForestClassifier(n_estimators=300, max_depth=8, random_state=random_state)
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)
    rf_importance = dict(zip(axis_keys, rf.feature_importances_.tolist()))
    rf_report = ClassifierReport(
        "RandomForest", accuracy_score(y_test, rf_pred), labels,
        confusion_matrix(y_test, rf_pred, labels=labels).tolist(), rf_importance,
    )

    return lr_report, rf_report, rf  # rf returned directly so the caller can persist it as the artifact


def print_classifier_report(report):
    print(report.summary_line())
    ranked = sorted(report.feature_importance.items(), key=lambda kv: kv[1], reverse=True)
    print("    feature importance (ranked):")
    for feat, val in ranked:
        print(f"      {feat:32s} {val:.4f}")
    print(f"    confusion matrix (rows=true, cols=predicted), labels={report.labels}:")
    for label, row in zip(report.labels, report.confusion):
        print(f"      {label:24s} {row}")
