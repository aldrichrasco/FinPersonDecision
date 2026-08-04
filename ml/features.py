"""
Feature engineering for the two PRD targets, against the REAL database
schema (db.py) — see ml/synthetic.py for why training itself ends up
running on a synthetic dataset instead of what these functions return.

WHAT'S ACTUALLY AVAILABLE VS. WHAT WOULD NEED NEW INSTRUMENTATION

The only table with real, per-event, per-user TIMESTAMPS is
scenario_choices (decision_index, wellbeing, zone, characteristic_drift,
created_at). That's what "first N days active" / "engagement frequency"
below is actually computed from.

learning_progress, achievements, and user_profile are each a single
overwrite-in-place row per user (user_id PRIMARY KEY, one JSON blob,
updated_at = last write time, not first). That means: no way to
reconstruct "how many lessons had they completed by day 7" from current
instrumentation — only "how many have they completed as of right now."
Every current-state feature below is flagged CURRENT_STATE for exactly
this reason. Fixing this for real would mean either periodic snapshotting
of these tables or turning them into an append-only event log the way
scenario_choices already is.

classroom_plays has no user_id column at all (anonymous by design, per its
own schema comment) — it cannot be joined to a specific user's conversion
or drop-off outcome under the current schema, so it isn't used here.
"""

import time

import pandas as pd

import db

CONVERSION_WINDOW_DAYS = 7
SECONDS_PER_DAY = 86400


def _load_users_df():
    with db._conn() as conn:
        cur = conn.cursor()
        cur.execute(f"SELECT id, created_at FROM users WHERE created_at IS NOT NULL")
        rows = cur.fetchall()
    return pd.DataFrame(rows, columns=["user_id", "signup_at"])


def _load_scenario_choices_df():
    with db._conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT user_id, decision_index, wellbeing, zone, characteristic_drift, created_at "
            "FROM scenario_choices WHERE user_id IS NOT NULL AND created_at IS NOT NULL"
        )
        rows = cur.fetchall()
    return pd.DataFrame(
        rows, columns=["user_id", "decision_index", "wellbeing", "zone", "characteristic_drift", "created_at"]
    )


def _load_subscriptions_df():
    with db._conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT user_id, status, created_at FROM subscriptions WHERE user_id IS NOT NULL")
        rows = cur.fetchall()
    return pd.DataFrame(rows, columns=["user_id", "status", "created_at"])


def build_conversion_dataset(window_days=CONVERSION_WINDOW_DAYS):
    """One row per user. Target: converted (1 if they ever had a
    subscription row at all — status is deliberately not filtered to
    "active", since the question is "did this behaviour predict them
    subscribing," not "are they still paying today," which is a different,
    also-valid but different question). Features: early-window (first
    `window_days` days after signup) engagement signals from
    scenario_choices, joined to CURRENT_STATE snapshot features from the
    other tables — see this module's docstring for why those two feature
    families aren't the same kind of thing."""
    users = _load_users_df()
    choices = _load_scenario_choices_df()
    subs = _load_subscriptions_df()

    if users.empty:
        return pd.DataFrame(columns=["user_id", "converted"])

    merged = choices.merge(users, on="user_id", how="inner")
    merged["days_since_signup"] = (merged["created_at"] - merged["signup_at"]) / SECONDS_PER_DAY
    early = merged[(merged["days_since_signup"] >= 0) & (merged["days_since_signup"] <= window_days)]

    agg = early.groupby("user_id").agg(
        early_decision_count=("decision_index", "count"),
        early_distinct_days_active=("created_at", lambda s: len({int(t // SECONDS_PER_DAY) for t in s})),
        early_mean_wellbeing=("wellbeing", "mean"),
        early_characteristic_drift_rate=("characteristic_drift", "mean"),
        first_decision_day=("days_since_signup", "min"),
    ).reset_index()

    converted_ids = set(subs["user_id"].dropna().astype(int))

    df = users[["user_id"]].merge(agg, on="user_id", how="left")
    for col in ["early_decision_count", "early_distinct_days_active", "early_characteristic_drift_rate"]:
        df[col] = df[col].fillna(0)
    df["early_mean_wellbeing"] = df["early_mean_wellbeing"].fillna(df["early_mean_wellbeing"].mean() if df["early_mean_wellbeing"].notna().any() else 50)
    df["first_decision_day"] = df["first_decision_day"].fillna(window_days + 1)  # never engaged in the window
    df["converted"] = df["user_id"].astype(int).isin(converted_ids).astype(int)

    return df[[
        "user_id", "early_decision_count", "early_distinct_days_active",
        "early_mean_wellbeing", "early_characteristic_drift_rate", "first_decision_day",
        "converted",
    ]]


def build_streak_dropoff_dataset(inactivity_threshold_days=5, min_streak_to_count=2):
    """One row per user who ever reached `min_streak_to_count` — someone who
    never really started doesn't have a "drop-off" to predict, they have a
    non-adoption story, which is a different question. Target: dropped_off
    (1 if it's been more than `inactivity_threshold_days` since their
    lastActivityDate). All features are CURRENT_STATE snapshots (see this
    module's docstring) — there is no real streak *history* to compute a
    genuine time-to-event target from under the current schema, which is
    exactly why the PRD's "time-to-event" option isn't implemented: it
    isn't honestly derivable from what's actually stored today."""
    import json

    with db._conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT user_id, progress_json FROM learning_progress")
        rows = cur.fetchall()

    now = time.time()
    records = []
    for user_id, blob in rows:
        try:
            p = json.loads(blob)
        except (TypeError, ValueError):
            continue
        streak = p.get("streak", 0) or 0
        if streak < min_streak_to_count:
            continue
        last_activity = p.get("lastActivityDate")
        if not last_activity:
            continue
        try:
            last_ts = time.mktime(time.strptime(last_activity, "%Y-%m-%d"))
        except ValueError:
            continue
        days_inactive = (now - last_ts) / SECONDS_PER_DAY
        records.append({
            "user_id": user_id,
            "streak_at_snapshot": streak,
            "xp_at_snapshot": p.get("xp", 0) or 0,
            "lessons_completed": len(p.get("completed", []) or []),
            "today_xp": p.get("todayXp", 0) or 0,
            "days_inactive": days_inactive,
            "dropped_off": int(days_inactive > inactivity_threshold_days),
        })

    return pd.DataFrame(records, columns=[
        "user_id", "streak_at_snapshot", "xp_at_snapshot", "lessons_completed",
        "today_xp", "days_inactive", "dropped_off",
    ])


def data_quality_report(df, target_col, min_per_class=50, max_test_fixture_fraction=0.5):
    """Whether a real-data pull is actually trainable — checked two ways,
    not just row count. A large row count from a database that's mostly
    pytest fixtures (this environment: 2,368 of 2,369 users are
    `*@example.com` accounts created by the test suite, not real signups)
    would pass a naive "n >= 50" check while still being noise, so this
    also measures what fraction of the rows in `df` belong to test-fixture
    accounts and refuses on that basis even when the row count looks fine.
    Returns (usable: bool, reason: str, stats: dict)."""
    stats = {"n": len(df)}
    if df.empty or target_col not in df:
        return False, "no rows", stats

    counts = df[target_col].value_counts()
    stats["class_counts"] = counts.to_dict()
    if len(counts) < 2 or counts.min() < min_per_class:
        return False, f"fewer than {min_per_class} examples in the minority class ({stats['class_counts']})", stats

    if "user_id" in df.columns:
        with db._conn() as conn:
            cur = conn.cursor()
            placeholders = ",".join(["?"] * len(df)) if not db.IS_POSTGRES else ",".join(["%s"] * len(df))
            cur.execute(
                f"SELECT COUNT(*) FROM users WHERE id IN ({placeholders}) AND email LIKE '%@example.com'",
                tuple(int(u) for u in df["user_id"]),
            )
            fixture_count = cur.fetchone()[0]
        fixture_fraction = fixture_count / len(df)
        stats["test_fixture_fraction"] = round(fixture_fraction, 4)
        if fixture_fraction > max_test_fixture_fraction:
            return False, (
                f"{fixture_fraction:.1%} of rows belong to @example.com test-fixture accounts "
                f"(> {max_test_fixture_fraction:.0%} threshold) — this is test-harness noise, not "
                "real product signal, regardless of row count"
            ), stats

    return True, "ok", stats
