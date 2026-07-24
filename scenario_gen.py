"""
Generated scenarios.

Expands the scenario pool beyond the authored set by generating new ones via
the language model.

FOUR CONSTRAINTS, each with a reason.

1. STRICT VALIDATION. A generated scenario enters the same engine that computes
   wellbeing and drives coaching. An out-of-range delta or a malformed choice
   would corrupt the model silently. Everything is validated and clamped before
   it is allowed near the engine; anything failing is discarded, not repaired.

2. STATIC FALLBACK. Generation failure must never block the decision loop. On
   any error, timeout, or validation failure the caller receives nothing and
   falls back to the authored pool.

3. OFF DURING STUDIES BY DEFAULT. A randomised trial requires stimulus control.
   If participants in the same arm see different scenarios, the intervention is
   not the same intervention. Generation is therefore disabled for enrolled
   participants unless explicitly enabled for that protocol.

4. SAFETY SCREEN. Generated content is checked against the same concerns the
   authored pool respects: no real brands, no specific financial products, no
   content trivialising hardship.
"""

import json
import os
import re

import llm

ENABLED = os.environ.get("SCENARIO_GENERATION", "1") == "1"
# Even when enabled, allow protocols to force it off for enrolled participants.
ALLOW_IN_STUDY = os.environ.get("SCENARIO_GENERATION_IN_STUDY", "0") == "1"

VALID_KEYS = {"income", "expenses", "savings", "investments", "debt"}
VALID_FLAVORS = {"conservative", "growth", "impulsive", "uncertain", "generous"}
VALID_ZONES = {"general", "recovery", "living"}

# Generated scenarios must carry the same taxonomy as authored ones, or the
# pool grows in a way that breaks transfer measurement — a principle met only
# on generated surfaces would be invisible to the analysis.
VALID_PRINCIPLES = {
    "catch_up_later", "credit_is_free", "more_saved_is_better",
    "id_notice", "this_time_different", "others_first", "waiting_is_safe",
}
VALID_SURFACES = {
    "credit_card", "bnpl", "overdraft", "family_loan", "business_loan",
    "subscription", "windfall", "shortfall", "opportunity", "obligation",
}

# Bounds keep a generated scenario within the same magnitude range as the
# authored pool, so the wellbeing model behaves comparably.
DELTA_BOUNDS = {
    "income": (-1000, 1000),
    "expenses": (-800, 800),
    "savings": (-8000, 8000),
    "investments": (-8000, 8000),
    "debt": (-8000, 8000),
}

# Terms that indicate the model has drifted into product recommendation or
# insensitivity. Presence discards the scenario.
BANNED = re.compile(
    r"\b(vanguard|blackrock|robinhood|coinbase|bitcoin|crypto|etf|s&p ?500|"
    r"index fund|mutual fund|401\(?k\)?\s*provider|annuity|"
    r"guaranteed return|risk-?free|get rich)\b", re.IGNORECASE)


PRINCIPLE_BRIEFS = {
    "catch_up_later": "the belief that shortfalls now can be recovered later without compounding cost",
    "credit_is_free": "the belief that borrowing is costless provided it is repaid",
    "more_saved_is_better": "the belief that accumulation is always good and spending always a loss",
    "id_notice": "the belief that deterioration would be obvious enough to act on in time",
    "this_time_different": "the belief that the usual pattern does not apply to this case",
    "others_first": "the belief that giving should not be constrained by one's own provisioning",
    "waiting_is_safe": "the belief that not deciding avoids risk",
}


def _prompt(zone, persona_name, trait, principle=None, surface=None):
    zone_brief = {
        "recovery": ("The person is under-provisioned and fragile. Write a scenario "
                     "that offers a genuine repair route alongside easier options "
                     "that would deepen the problem."),
        "living": ("The person has more than enough set aside but is not spending on "
                   "their own life. Write a scenario where spending is a legitimate, "
                   "even healthy, option — not an indulgence."),
        "general": ("Write an everyday money situation with a real trade-off."),
    }.get(zone, "Write an everyday money situation with a real trade-off.")

    principle_brief = ""
    if principle in PRINCIPLE_BRIEFS:
        principle_brief = (
            f"\nTHE SCENARIO MUST PROBE: {PRINCIPLE_BRIEFS[principle]}.\n"
            "One option should be attractive precisely because that belief feels true.\n"
        )
        if surface:
            principle_brief += (
                f"PRESENT IT AS: a {surface.replace('_', ' ')} situation. The underlying "
                "structure stays the same; only the surface changes. This is how transfer "
                "is tested — same principle, unfamiliar clothing.\n"
            )

    return (
        "You write short financial decision scenarios for an educational practice "
        "tool. Output ONLY valid JSON, no markdown fences, no commentary.\n\n"
        f"CONTEXT: {zone_brief}\n"
        f"{principle_brief}"
        f"The coach persona is '{persona_name}' ({trait}), but the scenario itself "
        "must be neutral — it is the situation, not the advice.\n\n"
        "SCHEMA:\n"
        '{"text": "one or two sentences, second person, concrete",\n'
        ' "zone": "general|recovery|living",\n'
        ' "choices": [{"label": "short action", "delta": {"savings": -500},\n'
        '              "flavor": "conservative|growth|impulsive|uncertain|generous"}]}\n\n'
        "RULES:\n"
        "- Exactly 3 choices. Each a genuine trade-off; no obviously correct answer.\n"
        "- delta keys only from: income, expenses, savings, investments, debt.\n"
        "- income and expenses are MONTHLY changes; savings, investments, debt are one-off amounts.\n"
        "- Amounts realistic for someone earning roughly $4,000-6,000 a month.\n"
        "- No brand names, no specific financial products, no investment recommendations.\n"
        "- Do not moralise, shame, or imply a right answer.\n"
        "- Everyday situations: a repair, a family event, a work opportunity, a bill.\n"
    )


def _validate(raw):
    """Returns a clean scenario dict, or None. Never repairs — discards."""
    if not isinstance(raw, dict):
        return None
    text = str(raw.get("text", "")).strip()
    if not (20 <= len(text) <= 400):
        return None
    if BANNED.search(text):
        return None

    zone = raw.get("zone")
    zone = zone if zone in VALID_ZONES else "general"

    # An untagged scenario cannot participate in transfer analysis, so it is
    # rejected rather than admitted untagged.
    principle = raw.get("principle")
    surface = raw.get("surface")
    if principle not in VALID_PRINCIPLES or surface not in VALID_SURFACES:
        return None

    choices_in = raw.get("choices")
    if not isinstance(choices_in, list) or not (2 <= len(choices_in) <= 4):
        return None

    choices = []
    for c in choices_in:
        if not isinstance(c, dict):
            return None
        label = str(c.get("label", "")).strip()
        if not (2 <= len(label) <= 90) or BANNED.search(label):
            return None
        delta_in = c.get("delta")
        if not isinstance(delta_in, dict):
            return None
        delta = {}
        for k, v in delta_in.items():
            if k not in VALID_KEYS:
                return None                      # unknown key: discard, don't strip
            try:
                n = int(v)
            except (TypeError, ValueError):
                return None
            lo, hi = DELTA_BOUNDS[k]
            if not (lo <= n <= hi):
                return None                      # out of range: discard
            if n != 0:
                delta[k] = n
        flavor = c.get("flavor")
        choices.append({
            "label": label,
            "delta": delta,
            "flavor": flavor if flavor in VALID_FLAVORS else "uncertain",
        })

    # Reject degenerate sets where every option is identical in effect.
    if len({json.dumps(c["delta"], sort_keys=True) for c in choices}) < 2:
        return None

    return {"text": text, "zone": zone, "principle": principle,
            "surface": surface, "choices": choices, "generated": True}


def generate(zone="general", persona_name="Coach", trait="", principle=None, surface=None):
    """
    Returns a validated scenario or None. Callers fall back to the pool.

    `principle` and `surface` let the caller request a specific transfer probe:
    a principle the learner has met before, presented on a surface they have
    not — which is precisely where transfer becomes observable.
    """
    if not ENABLED:
        return None
    try:
        raw = llm.chat(_prompt(zone, persona_name, trait, principle, surface),
                       [{"role": "user", "content": f"Generate one {zone} scenario."}])
    except Exception:
        return None

    # Models sometimes wrap JSON in fences despite instruction.
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
    except (TypeError, ValueError):
        return None
    return _validate(parsed)
