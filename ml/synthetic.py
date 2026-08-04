"""
SYNTHETIC data generators — not real product data.

Checked against the actual database (see ml/features.py): 2,368 of 2,369
users in this environment are pytest-fixture accounts (`*@example.com`,
created by the test suite across many runs), not real signups, and the one
real feature-rich table (scenario_choices) has essentially no relationship
to those fixture accounts' subscription status because both are test
artifacts, not organic behaviour. The streak_dropoff feature set is worse:
only 1 user in the whole database has ever reached a 2-day learning streak.
Training "the" model on either would produce numbers that look like a real
result but aren't one — the PRD's own guardrail is explicit about not
letting a write-up outrun the work, and presenting a model fit to
pytest-fixture noise as a product-outcome predictor would be exactly that.

What these functions do instead: generate a dataset with a DESIGNED,
documented, known feature -> target relationship, so the training pipeline
(ml/pipeline.py) can be built, run, and evaluated end-to-end against ground
truth that's known to be real (because it's defined right here, not
inferred). This is standard practice for validating a modeling pipeline
before real volume exists — the question synthetic data answers is "does
the pipeline correctly recover a signal that is genuinely there," not "what
do real users do." ml/train_*.py print this distinction every time they run
on synthetic data so it's never quietly presented as something it isn't.
"""

import numpy as np
import pandas as pd


def synthetic_conversion_dataset(n=4000, seed=42):
    """Designed relationship: conversion probability rises with early
    engagement (decision count, distinct active days) and with reaching a
    stable, in-range wellbeing early, and falls the longer someone waits to
    make their first decision. Mirrors the real feature set's shape
    (ml.features.build_conversion_dataset's columns) so the pipeline that
    validates against this also runs unmodified against real data later."""
    rng = np.random.default_rng(seed)

    early_decision_count = rng.poisson(lam=3.5, size=n)
    early_distinct_days_active = np.minimum(early_decision_count, rng.poisson(lam=2.2, size=n))
    early_mean_wellbeing = np.clip(rng.normal(loc=52, scale=15, size=n), 0, 100)
    early_characteristic_drift_rate = np.clip(rng.beta(a=1.5, b=6, size=n), 0, 1)
    first_decision_day = rng.exponential(scale=2.0, size=n)
    first_decision_day = np.where(early_decision_count == 0, 8.0, np.minimum(first_decision_day, 7.0))

    logit = (
        -2.6
        + 0.28 * early_decision_count
        + 0.22 * early_distinct_days_active
        - 0.015 * np.abs(early_mean_wellbeing - 55)  # near-homeostasis reads as "it's working for them"
        - 0.9 * early_characteristic_drift_rate
        - 0.18 * first_decision_day
    )
    prob = 1 / (1 + np.exp(-logit))
    converted = rng.binomial(1, prob)

    return pd.DataFrame({
        "early_decision_count": early_decision_count,
        "early_distinct_days_active": early_distinct_days_active,
        "early_mean_wellbeing": early_mean_wellbeing,
        "early_characteristic_drift_rate": early_characteristic_drift_rate,
        "first_decision_day": first_decision_day,
        "converted": converted,
    })


def synthetic_streak_dropoff_dataset(n=4000, seed=43):
    """Designed relationship: drop-off risk falls with a longer current
    streak and higher lifetime XP (sunk-cost / habit effects), and rises
    sharply with days already inactive (the closest thing to a real signal
    this target has — see ml/features.py's docstring on why there's no
    true streak history to compute a time-to-event target from). Mirrors
    ml.features.build_streak_dropoff_dataset's columns."""
    rng = np.random.default_rng(seed)

    streak_at_snapshot = rng.integers(2, 30, size=n)  # only users who ever reached streak>=2
    xp_at_snapshot = streak_at_snapshot * rng.integers(8, 15, size=n) + rng.integers(0, 50, size=n)
    lessons_completed = np.minimum(streak_at_snapshot // 2 + rng.poisson(1.5, size=n), 24)
    today_xp = rng.integers(0, 40, size=n)
    days_inactive = np.clip(rng.exponential(scale=2.5, size=n), 0, 30)

    logit = (
        -1.8
        - 0.09 * streak_at_snapshot
        - 0.01 * xp_at_snapshot
        - 0.05 * lessons_completed
        + 0.55 * days_inactive
    )
    prob = 1 / (1 + np.exp(-logit))
    dropped_off = rng.binomial(1, prob)

    return pd.DataFrame({
        "streak_at_snapshot": streak_at_snapshot,
        "xp_at_snapshot": xp_at_snapshot,
        "lessons_completed": lessons_completed,
        "today_xp": today_xp,
        "days_inactive": days_inactive,
        "dropped_off": dropped_off,
    })
