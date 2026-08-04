"""
Basic drift check: Population Stability Index (PSI) between a stored
baseline distribution and a new one — the standard, simple metric for "has
this categorical/binned distribution shifted meaningfully," used here for
archetype-assignment distribution and could equally be applied to any of
ml/'s other predicted-class or predicted-probability distributions.

PSI thresholds are the conventional industry ones (not invented for this
project): < 0.1 no significant shift, 0.1-0.25 moderate shift worth a
look, > 0.25 significant shift worth investigating before trusting the
new model's predictions in production.
"""

import json
import math
import os

PSI_NO_SHIFT = 0.1
PSI_MODERATE_SHIFT = 0.25


def population_stability_index(baseline: dict, current: dict, epsilon=1e-4):
    """baseline/current: {category: proportion} (proportions, not counts —
    caller normalizes; see distribution_from_counts). Categories present in
    one but not the other are treated as epsilon-proportion in the missing
    one, which is what correctly produces a large PSI contribution for a
    category that vanished or newly appeared, rather than a silent zero."""
    categories = set(baseline) | set(current)
    psi = 0.0
    contributions = {}
    for cat in categories:
        b = max(baseline.get(cat, 0.0), epsilon)
        c = max(current.get(cat, 0.0), epsilon)
        term = (c - b) * math.log(c / b)
        contributions[cat] = term
        psi += term
    return psi, contributions


def predicted_counts_from_confusion(confusion, labels):
    """Predicted-class counts derived from a confusion matrix (rows=true,
    cols=predicted) — cm[i][j] is the count of true class i predicted as
    class j, so summing column j gives "how many times the model predicted
    class j," independent of what was actually true. Shared by every
    ml/train_*.py script (binary 2x2 or the archetype model's 11x11) so
    this logic exists once, not once per script."""
    counts = {label: 0 for label in labels}
    for row in confusion:
        for j, label in enumerate(labels):
            counts[label] += row[j]
    return counts


def distribution_from_counts(counts: dict):
    total = sum(counts.values())
    if total == 0:
        return {k: 0.0 for k in counts}
    return {k: v / total for k, v in counts.items()}


def classify_shift(psi):
    if psi < PSI_NO_SHIFT:
        return "no significant shift"
    if psi < PSI_MODERATE_SHIFT:
        return "moderate shift — worth a look"
    return "significant shift — investigate before trusting this model's predictions"


def check_against_baseline(baseline_path, current_counts, label="distribution"):
    """Loads (or, on first run, creates) a stored baseline and reports
    drift against it. Returns (psi, verdict, is_first_run).

    Category keys are normalized to strings before any comparison —
    JSON object keys are always strings, so an integer-keyed distribution
    (e.g. the binary {0: ..., 1: ...} targets) would otherwise silently
    round-trip through the baseline file as {"0": ..., "1": ...} and
    compare as entirely different categories from the in-memory {0: ...,
    1: ...} on the next run, producing a spurious, enormous PSI. Found
    exactly this way — a from-scratch second run reported a "significant
    shift" against a baseline saved moments earlier from IDENTICAL
    predictions, which is what made the type mismatch obvious."""
    current_dist = {str(k): v for k, v in distribution_from_counts(current_counts).items()}
    current_counts_str = {str(k): v for k, v in current_counts.items()}

    if not os.path.exists(baseline_path):
        os.makedirs(os.path.dirname(baseline_path), exist_ok=True)
        with open(baseline_path, "w", encoding="utf-8") as f:
            json.dump({"distribution": current_dist, "counts": current_counts_str}, f, indent=2)
        return None, "no baseline existed — this run's distribution is now the baseline", True

    with open(baseline_path, encoding="utf-8") as f:
        baseline = json.load(f)

    psi, contributions = population_stability_index(baseline["distribution"], current_dist)
    verdict = classify_shift(psi)
    print(f"\nDrift check ({label}) vs. stored baseline ({baseline_path}):")
    print(f"  PSI = {psi:.4f} -> {verdict}")
    ranked = sorted(contributions.items(), key=lambda kv: abs(kv[1]), reverse=True)
    for cat, contribution in ranked[:5]:
        print(f"    {cat:28s} baseline={baseline['distribution'].get(cat, 0):.3f} "
              f"current={current_dist.get(cat, 0):.3f} contribution={contribution:+.4f}")
    return psi, verdict, False
