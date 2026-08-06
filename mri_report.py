"""
The Advanced Financial MRI report — the paid-tier content behind the
Supporter subscription (same subscription_active() gate as live coaching
and FinPerson Pro; see server.py's /api/mri/report).

This is deliberately NOT a new simulation to complete. It's a cross-
exercise analysis of data every free exercise already produces: the quiz's
self-report profile, real turtle-sim rounds (did you follow or override
the systematic rule, and in which direction), real Crypto Impulse Check
decisions, and how much practice you've actually logged across Roadmap/
Training. "MRI" earns its name here — a scan across what's already there,
not one more thing to do.

Guardrail (same one the ML/PRD phase of this app follows throughout):
report what the data actually shows — counts, rates, plain differences —
never a manufactured score out of 100, and every section that could be
built on too little data says so explicitly rather than presenting a
confident-looking number from 2 data points.
"""

import json
import os

_PROFILES_PATH = os.path.join(os.path.dirname(__file__), "ml", "archetype_profiles.json")
_profiles_cache = None

# Ordinal risk ranking used to score whether a turtle-sim override skewed
# more aggressive or more conservative than the rule's own signal — "hold"
# sits between the two directional actions, not equal to either.
_RISK_RANK = {"sell": 0, "hold": 1, "buy": 2}

# Below this many overridden rounds, a direction-bias read is treated as
# too thin to report rather than shown with false confidence.
_MIN_OVERRIDES_FOR_BIAS = 3


def _load_archetype_profiles():
    global _profiles_cache
    if _profiles_cache is None:
        with open(_PROFILES_PATH, encoding="utf-8") as f:
            data = json.load(f)
        _profiles_cache = (data["axis_keys"], data["archetype_profiles"])
    return _profiles_cache


def self_report_section(profile_blob):
    """The quiz's own profile + matched archetype, plus a closeness read
    (same distance-to-target-profile math as fbm.js's archetypeCloseness,
    ported to Python since this report is server-rendered)."""
    if not profile_blob or not profile_blob.get("archetype"):
        return None
    profile = profile_blob.get("profile") or {}
    archetype = profile_blob["archetype"]
    axis_keys, archetype_profiles = _load_archetype_profiles()
    target = archetype_profiles.get(archetype)
    closeness = None
    if target:
        dist = sum((profile.get(k, 50) - target[k]) ** 2 for k in axis_keys) ** 0.5
        max_dist = (len(axis_keys) * 100 ** 2) ** 0.5
        closeness = round(max(0, 100 - (dist / max_dist) * 100))
    return {"profile": profile, "archetype": archetype, "closeness": closeness}


def _override_direction_bias(rounds):
    """+1 per override more aggressive than the rule's signal (e.g. buy
    when the rule said hold/sell), -1 per override more conservative.
    Net > 0 means overrides skew toward more risk than the systematic
    rule; net < 0 means they skew toward more caution. Returns
    (net, overridden_count) — callers decide what counts as "enough"."""
    net = 0
    overridden_count = 0
    for r in rounds:
        if not r.get("overridden"):
            continue
        overridden_count += 1
        signal_rank = _RISK_RANK.get(r.get("signal"), 1)
        action_rank = _RISK_RANK.get(r.get("playerAction"), 1)
        if action_rank > signal_rank:
            net += 1
        elif action_rank < signal_rank:
            net -= 1
    return net, overridden_count


def turtle_sim_section(sessions):
    """Real systematic-rule-adherence signal across every saved Turtle
    Trading run: total overrides, which direction they skewed, and
    whether overriding helped or cost relative to just following the
    rule. `sessions` rows are expected to include a parsed `rounds` list
    (see db.get_turtle_sessions_with_rounds) — this function does not
    touch the database itself."""
    if not sessions:
        return {"sessions": 0}
    all_rounds = [r for s in sessions for r in (s.get("rounds") or [])]
    net_bias, overridden_count = _override_direction_bias(all_rounds)
    avg_rule = sum(s.get("final_rule_equity", 1.0) for s in sessions) / len(sessions)
    avg_player = sum(s.get("final_player_equity", 1.0) for s in sessions) / len(sessions)
    beat_rule = sum(1 for s in sessions if s.get("final_player_equity", 1.0) >= s.get("final_rule_equity", 1.0))
    return {
        "sessions": len(sessions),
        "total_overrides": overridden_count,
        "override_direction_bias": net_bias if overridden_count >= _MIN_OVERRIDES_FOR_BIAS else None,
        "avg_rule_equity_pct": round((avg_rule - 1) * 100, 1),
        "avg_player_equity_pct": round((avg_player - 1) * 100, 1),
        "beat_rule_rate_pct": round(beat_rule / len(sessions) * 100, 1),
    }


def crypto_impulse_section(decisions):
    """Real revealed decisions on actual historical volatility events —
    just the choice breakdown and average real outcome. (Whether each
    choice matched the Donchian rule isn't persisted per-decision, so
    that comparison isn't claimed here — only what's actually stored.)"""
    if not decisions:
        return {"decisions": 0}
    n = len(decisions)
    choice_counts = {"buy": 0, "hold": 0, "sell": 0}
    for d in decisions:
        c = d.get("choice")
        if c in choice_counts:
            choice_counts[c] += 1
    avg_outcome = sum(d.get("outcome_pct_change", 0) or 0 for d in decisions) / n
    return {"decisions": n, "choice_counts": choice_counts, "avg_outcome_pct_change": round(avg_outcome, 2)}


def practice_volume_section(roadmap_progress, training_progress):
    completed = (roadmap_progress or {}).get("completed") or []
    training_entries = training_progress or {}
    total_reps = sum((e or {}).get("repCount", 0) for e in training_entries.values())
    return {
        "levels_completed": len(completed),
        "training_reps": total_reps,
        "axes_in_training": len(training_entries),
    }


# Axes where the turtle-sim's buy/hold/sell action maps onto the same
# real-world trait the quiz's risk_disposition axis asks about — the only
# self-report axis this report currently has a genuine behavioral
# comparison for. Extending to other axes would need a similar revealed-
# behavior signal for each, which doesn't exist yet (see this file's own
# guardrail: no comparison without real data behind it).
def revealed_vs_stated_note(self_report, turtle_sim):
    if not self_report or turtle_sim.get("override_direction_bias") is None:
        return None
    risk_score = (self_report.get("profile") or {}).get("risk_disposition")
    if not isinstance(risk_score, (int, float)):
        return None
    bias = turtle_sim["override_direction_bias"]
    stated_averse = risk_score <= 40
    stated_tolerant = risk_score >= 60
    if stated_averse and bias > 0:
        return ("Your quiz profile reads risk-averse, but when you've overridden the Turtle Trading rule, "
                "it's skewed toward MORE aggressive calls than the rule itself — worth noticing whether that's "
                "situational or a real gap between how you describe yourself and what you actually do under pressure.")
    if stated_tolerant and bias < 0:
        return ("Your quiz profile reads risk-tolerant, but when you've overridden the Turtle Trading rule, "
                "it's skewed toward MORE cautious calls than the rule itself — worth noticing whether that's "
                "situational or a real gap between how you describe yourself and what you actually do under pressure.")
    return None


def build_report(profile_blob, turtle_sessions, crypto_decisions, roadmap_progress, training_progress):
    self_report = self_report_section(profile_blob)
    turtle_sim = turtle_sim_section(turtle_sessions)
    return {
        "self_report": self_report,
        "turtle_sim": turtle_sim,
        "crypto_impulse": crypto_impulse_section(crypto_decisions),
        "practice_volume": practice_volume_section(roadmap_progress, training_progress),
        "revealed_vs_stated_note": revealed_vs_stated_note(self_report, turtle_sim),
    }
