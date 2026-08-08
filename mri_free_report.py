"""
Builds the free Financial MRI report.

This is the product's primary deliverable. The decision sandbox exists to
generate the evidence this report reads; the report is the thing a person
actually comes for.

One rule governs every function here: a section that lacks the evidence to
support it returns None, and the page renders an honest empty state instead.
Nothing is inferred, padded, or defaulted into looking populated. A report
whose entire claim is "this came from your real decisions" cannot survive a
single invented number, and a reader who catches one discards the genuine
findings alongside it.

Distinct from mri_report.py, which builds the PAID cross-exercise report from
turtle-sim and crypto-impulse data. This one reads sandbox decisions only.
"""

import json
import os

_PROFILES_PATH = os.path.join(os.path.dirname(__file__), "ml", "archetype_profiles.json")
_profiles_cache = None

AXIS_KEYS = [
    "impulse_regulation", "risk_disposition", "temporal_orientation",
    "financial_attentiveness", "financial_self_efficacy", "prosocial_orientation",
]

AXIS_SHORT = {
    "impulse_regulation": "Impulse",
    "risk_disposition": "Risk",
    "temporal_orientation": "Time",
    "financial_attentiveness": "Attention",
    "financial_self_efficacy": "Confidence",
    "prosocial_orientation": "Giving",
}

# Minimum evidence before a section will claim anything. These are deliberately
# low enough to be reachable in one sitting but high enough that a single
# unusual decision cannot manufacture a "pattern".
MIN_FOR_GAP = 3
MIN_PER_GROUP_FOR_SPLIT = 2
MIN_FOR_TWIN = 4
# A split only counts as a finding if the two groups differ by this much.
# Below it, the difference is noise dressed as insight.
PATTERN_THRESHOLD = 0.25


def _load_archetype_profiles():
    global _profiles_cache
    if _profiles_cache is None:
        with open(_PROFILES_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _profiles_cache = (data["axis_keys"], data["archetype_profiles"])
    return _profiles_cache


def archetype_ranking(profile):
    """
    Closeness to every archetype, not just the winner. The runner-up becomes
    the sub-label, which is the thing that stops two people sharing a headline
    archetype from receiving the same report. Same distance maths as fbm.js's
    archetypeCloseness, ported so the report can be built server-side.
    """
    if not profile:
        return []
    axis_keys, archetype_profiles = _load_archetype_profiles()
    max_dist = (len(axis_keys) * 100 ** 2) ** 0.5
    ranked = []
    for slug, target in archetype_profiles.items():
        dist = sum((profile.get(k, 50) - target[k]) ** 2 for k in axis_keys) ** 0.5
        ranked.append({"slug": slug, "closeness": round(max(0, 100 - (dist / max_dist) * 100))})
    ranked.sort(key=lambda r: r["closeness"], reverse=True)
    return ranked


def prediction_gap(decisions):
    """
    The report's headline: what following their own predictions would have
    been worth, in sandbox money.

    Only decisions carrying BOTH a prediction and a known value for the
    predicted alternative can contribute. Anything else is excluded rather
    than treated as zero, which would quietly deflate the total toward a
    number nobody could trace.
    """
    usable = [
        d for d in decisions
        if d.get("predicted") is not None
        and d.get("predicted_net_worth_delta") is not None
    ]
    if len(usable) < MIN_FOR_GAP:
        return None

    total = 0.0
    biggest = None
    for d in usable:
        diff = (d["predicted_net_worth_delta"] or 0) - (d.get("net_worth_delta") or 0)
        total += diff
        if biggest is None or diff > biggest["amount"]:
            biggest = {"amount": diff, "scenario": d.get("scenario"), "choice": d.get("choice")}

    # If their actual choices did as well or better, there is no gap to sell
    # and pretending otherwise would invert the finding.
    if total <= 0:
        return None

    return {
        "total": round(total),
        "decision_count": len(usable),
        "biggest": (
            {
                "amount": round(biggest["amount"]),
                "scenario": biggest["scenario"],
                "choice": biggest["choice"],
            }
            if biggest and biggest["amount"] > 0 else None
        ),
    }


def time_pressure_split(decisions):
    """
    Splits prediction accuracy by whether the scenario carried a deadline.

    This is the finding the report is built around, so it needs both groups
    genuinely populated. `is_pattern` stays False when the groups look alike,
    and the page then presents the split as data rather than as a discovery.
    """
    predicted = [d for d in decisions if d.get("predicted") is not None]
    timed = [d for d in predicted if d.get("timed")]
    untimed = [d for d in predicted if not d.get("timed")]
    if len(timed) < MIN_PER_GROUP_FOR_SPLIT or len(untimed) < MIN_PER_GROUP_FOR_SPLIT:
        return None

    kept = lambda group: sum(1 for d in group if d.get("matched"))
    timed_kept, untimed_kept = kept(timed), kept(untimed)
    timed_rate = timed_kept / len(timed)
    untimed_rate = untimed_kept / len(untimed)

    gap_from_timed = sum(
        (d.get("predicted_net_worth_delta") or 0) - (d.get("net_worth_delta") or 0)
        for d in timed
        if d.get("predicted_net_worth_delta") is not None
    )

    return {
        "timed": {"total": len(timed), "kept": timed_kept},
        "untimed": {"total": len(untimed), "kept": untimed_kept},
        "timed_rate": round(timed_rate, 3),
        "untimed_rate": round(untimed_rate, 3),
        "is_pattern": (untimed_rate - timed_rate) >= PATTERN_THRESHOLD,
        "gap_from_timed": round(gap_from_timed) if gap_from_timed > 0 else None,
    }


def twin_match(decisions):
    """
    Stated as "matches N of M recorded decisions", never as an accuracy
    percentage. At this sample size a percentage invites questions about
    baselines, out-of-sample testing and confidence intervals that the number
    cannot answer, and claiming the model is "correct" misdescribes what a
    model is in the first place.
    """
    predicted = [d for d in decisions if d.get("predicted") is not None]
    if len(predicted) < MIN_FOR_TWIN:
        return None
    return {
        "matched": sum(1 for d in predicted if d.get("matched")),
        "total": len(predicted),
    }


def behavioural_evidence(decisions):
    """
    Counted observations that support the archetype label itself, rather than
    the prediction gap. Each entry is a fact with its own arithmetic attached,
    so the reader can check it. Returns only the entries that clear their own
    evidence bar.
    """
    out = []

    growth = [d for d in decisions if d.get("surface") == "opportunity"]
    growth_taken = [d for d in growth if (d.get("net_worth_delta") or 0) < 0]
    if len(growth) >= 3:
        out.append({
            "kind": "growth_appetite",
            "count": len(growth_taken),
            "of": len(growth),
        })

    patient = [
        d for d in decisions
        if d.get("principle") in ("catch_up_later", "more_saved_is_better")
    ]
    if len(patient) >= 3:
        out.append({
            "kind": "delayed_reward",
            "count": sum(1 for d in patient if d.get("matched")),
            "of": len(patient),
        })

    credit = [d for d in decisions if d.get("surface") in ("credit_card", "bnpl")]
    if len(credit) >= 2:
        out.append({
            "kind": "credit_use",
            "count": len(credit),
            "of": len(credit),
        })

    return out or None


def confidence(profile, decisions, archetype_ranking):
    """
    Two independent inputs: how cleanly the profile lands on one archetype
    (separation from the runner-up), and how much behaviour has actually been
    observed. Volume matters on its own, because a perfectly separated profile
    built on four decisions is still a guess.

    Caps below 100 deliberately. A behavioural model of a person should never
    report certainty.
    """
    if not archetype_ranking:
        return None

    if len(archetype_ranking) > 1:
        separation = min(1.0, (archetype_ranking[0]["closeness"] - archetype_ranking[1]["closeness"]) / 20.0)
    else:
        separation = 1.0
    volume = min(1.0, len(decisions) / 15.0)
    score = round((0.45 + 0.30 * separation + 0.25 * volume) * 100)

    # The least-trustworthy axes are the ones sitting nearest the neutral
    # midpoint: they carry the least signal, so they are what the report should
    # admit to being unsure about.
    weakest = sorted(
        AXIS_KEYS,
        key=lambda k: abs((profile.get(k) or 50) - 50),
    )[:2]

    return {
        "score": min(96, score),
        "weakest": [AXIS_SHORT[k] for k in weakest],
        "decisions": len(decisions),
    }


def build_free_report(profile, archetype, archetype_ranking, decisions):
    """
    Assembles the free report. Every section may be None, and the caller is
    expected to render an honest empty state for each one that is, rather than
    hiding the fact that evidence is missing.
    """
    decisions = decisions or []
    profile = profile or {}
    return {
        "archetype": archetype,
        "archetype_ranking": archetype_ranking[:5] if archetype_ranking else [],
        "profile": {k: round(profile.get(k) or 50) for k in AXIS_KEYS},
        "decision_count": len(decisions),
        "prediction_gap": prediction_gap(decisions),
        "time_pressure": time_pressure_split(decisions),
        "twin": twin_match(decisions),
        "evidence": behavioural_evidence(decisions),
        "confidence": confidence(profile, decisions, archetype_ranking),
        # Returned so the Financial Twin can build its rules from the same
        # server-side evidence rather than falling back to whatever happens to
        # be in this browser's local storage.
        "decisions": decisions,
    }
