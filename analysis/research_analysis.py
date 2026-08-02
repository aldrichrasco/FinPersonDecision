"""
Phase 3 efficacy-trial analysis pipeline for the naturalistic evaluation
proposed in PAPER.md, Sections 8.4-8.5.

PAPER.md §8.4 states the trial instrumentation is complete — pseudonymous
enrolment, a consent gate, deterministic arm allocation, event-level capture,
and CSV export are all implemented and tested — and that "Phases 1-3 are
executable against the current artefact without further development." What
that section doesn't include is the analysis side: something that actually
loads the exported tables and runs the tests the paper's own propositions
call for. That's what this script is.

It maps directly onto specific claims in the paper rather than running
generic stats for their own sake:

  Section 1 — recruitment/consent funnel by arm         (§8.4 instrumentation)
  Section 2 — engagement volume by arm                  (tests P2, §5.7)
  Section 3 — ablation manipulation check                (§8.4 "genuine ablation")
  Section 4 — calibration progression                    (tests P1, §7.9)
  Section 5 — wellbeing/zone distribution                (context for §8.2)

IMPORTANT — read PAPER.md §8.1 before trusting any number this prints: "no
evaluation with human participants has been conducted." Whatever is in the
local database right now is dev/test data, not the Phase 3 trial. Every
section below is written to degrade to an explicit "insufficient data" rather
than fabricate a result when the current dataset can't support a given test —
that's the honest behaviour, and it's also what makes this script ready to
point at real trial data the moment it exists, with no changes needed.

Setup:
    pip install -r analysis/requirements-analysis.txt

Run (from the repo root, so it finds finperson.db / DATABASE_URL the same
way server.py does):
    python analysis/research_analysis.py
"""

import os
import sys

# Windows' default console codepage (cp1252) can't encode the section
# markers/arrows below; force utf-8 so this runs the same on any platform
# instead of crashing partway through a report.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import pandas as pd
import statsmodels.formula.api as smf

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db  # noqa: E402


def _query_df(sql):
    with db._conn() as conn:
        return pd.read_sql_query(sql, conn)


def load_participants():
    df = _query_df("""
        SELECT code, arm, cohort, consent_version, consented_at, enrolled_at, withdrawn_at
        FROM study_participants
    """)
    df["consented"] = df["consented_at"].notna()
    df["withdrawn"] = df["withdrawn_at"].notna()
    return df


def load_events():
    return _query_df("""
        SELECT e.code, p.arm, e.session_id, e.event_type, e.client_ts, e.server_ts
        FROM study_events e
        LEFT JOIN study_participants p ON p.code = e.code
    """)


def load_decisions(participants):
    """Decision-level telemetry (scenario_choices) isn't directly foreign-keyed
    to study_participants — arm lives on `code` (participants/events), decisions
    live on `session_id` (scenario_choices). We join through whatever
    session_id <-> code pairs actually show up together in study_events, and
    report what fraction of decisions that join actually covers, rather than
    silently assume every decision belongs to a study participant — most
    sandbox usage in a dev database is ordinary (non-study) traffic, and
    treating it as trial data would be a real methodological error, not a
    rounding one."""
    decisions = _query_df("SELECT * FROM scenario_choices")
    session_arm = _query_df("""
        SELECT DISTINCT session_id, code FROM study_events
        WHERE session_id IS NOT NULL AND session_id != ''
    """).merge(participants[["code", "arm"]], on="code", how="left")
    session_arm = session_arm.dropna(subset=["session_id"]).drop_duplicates("session_id")
    merged = decisions.merge(session_arm[["session_id", "arm"]], on="session_id", how="left")
    coverage = merged["arm"].notna().mean() if len(merged) else 0.0
    return merged, coverage


def section(title):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


def report_enrollment_funnel(participants, events):
    section("1. Recruitment & consent funnel, by arm  (PAPER.md §8.4)")
    if participants.empty:
        print("No study participants enrolled yet.")
        return
    has_event = set(events.loc[events["code"].notna(), "code"])
    funnel = participants.groupby("arm").agg(
        enrolled=("code", "count"),
        consented=("consented", "sum"),
        withdrawn=("withdrawn", "sum"),
    )
    funnel["produced_event"] = (
        participants.assign(has_event=participants["code"].isin(has_event))
        .groupby("arm")["has_event"].sum()
    )
    print(funnel.to_string())
    print(
        f"\nTotal: {len(participants)} enrolled, {int(participants['consented'].sum())} consented, "
        f"{int(participants['withdrawn'].sum())} withdrawn."
    )


def report_engagement_by_arm(participants, events):
    section("2. Engagement volume by arm  (tests P2: personalisation → engagement, §5.7)")
    if participants.empty:
        print("No study participants enrolled yet.")
        return
    counts = events.groupby("code").size().rename("event_count")
    merged = participants.merge(counts, on="code", how="left")
    merged["event_count"] = merged["event_count"].fillna(0)
    print(merged.groupby("arm")["event_count"].agg(["count", "mean", "std"]).to_string())

    if merged["arm"].nunique() >= 2 and merged["event_count"].sum() > 0:
        model = smf.ols("event_count ~ C(arm)", data=merged).fit()
        print("\nOLS: event_count ~ arm")
        print(model.summary().tables[1])
    else:
        print("\nInsufficient variation to fit a model yet (need events across at least two arms).")


def report_ablation_manipulation_check(decisions, coverage):
    section(
        "3. Ablation manipulation check  (PAPER.md §8.4: characteristic-drift\n"
        "   detection must be disabled outside the FULL arm — this checks that it is)"
    )
    print(f"session_id → arm join coverage: {coverage:.0%} of decision rows matched to a study participant.")
    linked = decisions.dropna(subset=["arm"]) if "arm" in decisions else decisions.iloc[0:0]
    if linked.empty:
        print("No decisions currently link to a study participant — nothing to check yet. "
              "(Most rows in a dev database come from ordinary, non-study sandbox use, which "
              "carries no session_id ↔ study code link by design.)")
        return
    linked = linked.copy()
    linked["drift_flag"] = linked["characteristic_drift"].fillna(0).astype(int)
    rate = linked.groupby("arm")["drift_flag"].mean()
    print(rate.to_string())
    if len(linked) < 20:
        print(f"\nOnly {len(linked)} linked decisions so far — too few to conclude anything either way.")
    elif rate.get("full", 0) > 0 and rate.drop("full", errors="ignore").sum() == 0:
        print("\nConsistent with the design: drift is only ever flagged in the FULL arm.")
    else:
        print("\nDrift is being flagged outside the FULL arm — worth checking the ablation gate in "
              "study.ARM_FEATURES / the scenario-selection code that reads it.")


def report_calibration_progression(decisions):
    section(
        "4. Calibration progression  (tests P1: legibility → behaviour change; §7.9's\n"
        "   'recognition rank' claim)"
    )
    cal = decisions.dropna(subset=["principle"]) if "principle" in decisions else decisions.iloc[0:0]
    if cal.empty:
        print(
            "0 rows have a completed prediction/reflection cycle (principle IS NOT NULL).\n"
            "This is the primary Phase 3 outcome variable and needs real participant sessions\n"
            "to populate — nothing to fabricate here. Ready to run once it exists:\n\n"
            '    cal = decisions.dropna(subset=["principle"])\n'
            '    smf.logit("prediction_correct ~ decision_index", data=cal).fit()\n'
        )
        return
    cal = cal.copy()
    cal["prediction_correct"] = cal["prediction_correct"].astype(int)
    model = smf.logit("prediction_correct ~ decision_index", data=cal).fit(disp=0)
    print(model.summary().tables[1])


def report_wellbeing_distribution(decisions):
    section(
        "5. Wellbeing/zone distribution  (context for §8.2's non-monotonicity claim —\n"
        "   observed usage rather than the paper's 3 hand-picked test profiles)"
    )
    if "zone" not in decisions or decisions["zone"].dropna().empty:
        print("No zone data in the current dataset.")
        return
    print(decisions["zone"].value_counts(dropna=False).to_string())
    if decisions["wellbeing"].notna().any():
        print("\nwellbeing score summary:")
        print(decisions["wellbeing"].describe().to_string())


def main():
    pd.set_option("display.width", 100)
    participants = load_participants()
    events = load_events()
    decisions, coverage = load_decisions(participants)

    backend = "Postgres (DATABASE_URL set)" if db.IS_POSTGRES else f"SQLite ({db.SQLITE_PATH})"
    print("FinPerson research-data analysis")
    print(f"Data source: {backend}  —  see PAPER.md §8 for the study design this operationalises.")

    report_enrollment_funnel(participants, events)
    report_engagement_by_arm(participants, events)
    report_ablation_manipulation_check(decisions, coverage)
    report_calibration_progression(decisions)
    report_wellbeing_distribution(decisions)


if __name__ == "__main__":
    main()
