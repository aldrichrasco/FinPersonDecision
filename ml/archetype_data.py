"""
Real quiz-response data for the archetype rebuild — pulled from
user_profile (the six-axis profile + matched archetype every signed-in
user's quiz/assessment result is saved to; see db.get_user_profile /
db.save_user_profile). This is the closest real analogue to "quiz response
data" the PRD asks for: db.export_research_dataset() (the Prolific study
export it names) only exports participant consent status, not response
content — see that function in db.py.
"""

import json

import pandas as pd

import db

AXIS_KEYS = [
    "impulse_regulation", "risk_disposition", "temporal_orientation",
    "financial_attentiveness", "financial_self_efficacy", "prosocial_orientation",
]


def build_archetype_dataset():
    """One row per signed-in user with a saved profile. Columns: user_id,
    the six axis scores, and archetype (their currently-matched label, from
    fbm.js's nearest-neighbor matcher — this is what a classifier trained
    here would be predicting *instead of*)."""
    with db._conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT user_id, profile_json FROM user_profile")
        rows = cur.fetchall()

    records = []
    for user_id, blob in rows:
        try:
            data = json.loads(blob)
        except (TypeError, ValueError):
            continue
        profile = data.get("profile")
        archetype = data.get("archetype")
        if not isinstance(profile, dict) or not archetype:
            continue
        if set(profile.keys()) != set(AXIS_KEYS):
            continue
        record = {"user_id": user_id, "archetype": archetype}
        record.update({axis: profile[axis] for axis in AXIS_KEYS})
        records.append(record)

    return pd.DataFrame(records, columns=["user_id", *AXIS_KEYS, "archetype"])
