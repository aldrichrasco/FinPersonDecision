"""
Generated quiz tie-breaker questions.

Mirrors scenario_gen.py's shape exactly, same four constraints and same
reasoning for each:

1. STRICT VALIDATION. A generated question feeds axis deltas into the same
   profile the quiz result and archetype match are built from. An
   out-of-range delta or an unknown axis key would corrupt that silently.
   Everything is validated and clamped before use; anything failing is
   discarded, not repaired.

2. STATIC FALLBACK. Generation failure must never block the quiz. On any
   error, timeout, or validation failure the caller gets None and falls back
   to the authored TIEBREAKER_QUESTIONS bank in quiz.js.

3. OFF DURING STUDIES BY DEFAULT. Research-mode participants need the exact
   same tie-breaker question as every other participant in their arm for the
   DSS paper's validity — generation is disabled for enrolled, consented
   participants unless a protocol explicitly turns it on, identical to
   scenario_gen.py's ALLOW_IN_STUDY.

4. SAFETY SCREEN. Same banned-terms check as scenario_gen.py — no brand
   names, no specific financial products, no investment recommendations.
"""

import json
import os
import re

import llm

ENABLED = os.environ.get("QUIZ_GENERATION", "1") == "1"
ALLOW_IN_STUDY = os.environ.get("QUIZ_GENERATION_IN_STUDY", "0") == "1"

VALID_AXES = {
    "impulse_regulation", "risk_disposition", "temporal_orientation",
    "financial_attentiveness", "financial_self_efficacy", "prosocial_orientation",
}
DELTA_BOUNDS = (-25, 25)

BANNED = re.compile(
    r"\b(vanguard|blackrock|robinhood|coinbase|bitcoin|crypto|etf|s&p ?500|"
    r"index fund|mutual fund|401\(?k\)?\s*provider|annuity|"
    r"guaranteed return|risk-?free|get rich)\b", re.IGNORECASE)


def _prompt(situation_label, axis_a, axis_b):
    return (
        "You write short quiz questions for a financial-behaviour self-assessment "
        "in an educational practice tool. Output ONLY valid JSON, no markdown "
        "fences, no commentary.\n\n"
        f"CONTEXT: The person said their situation is: \"{situation_label}\". "
        f"Their answers so far put them roughly between two behavioural patterns, "
        f"distinguished mainly by two traits: {axis_a} and {axis_b}.\n\n"
        "Write ONE tie-breaking question whose answer options pull toward one "
        "trait or the other, phrased in a way that feels specific to their stated "
        "situation rather than generic.\n\n"
        "SCHEMA:\n"
        '{"question": "one sentence, second person",\n'
        ' "options": [{"label": "short answer", "delta": {"' + axis_a + '": 15}}]}\n\n'
        "RULES:\n"
        "- Exactly 3 or 4 options. Each a genuinely different stance, no obviously "
        "\"correct\" one.\n"
        f"- delta keys only from: {', '.join(sorted(VALID_AXES))}.\n"
        "- delta values between -25 and 25.\n"
        "- No brand names, no specific financial products, no investment advice.\n"
        "- Do not moralise or imply a right answer.\n"
    )


def _validate(raw):
    """Returns a clean {question, options} dict, or None. Never repairs — discards."""
    if not isinstance(raw, dict):
        return None
    question = str(raw.get("question", "")).strip()
    if not (10 <= len(question) <= 200) or BANNED.search(question):
        return None

    options_in = raw.get("options")
    if not isinstance(options_in, list) or not (2 <= len(options_in) <= 5):
        return None

    options = []
    for o in options_in:
        if not isinstance(o, dict):
            return None
        label = str(o.get("label", "")).strip()
        if not (2 <= len(label) <= 100) or BANNED.search(label):
            return None
        delta_in = o.get("delta")
        if not isinstance(delta_in, dict):
            return None
        delta = {}
        for k, v in delta_in.items():
            if k not in VALID_AXES:
                return None
            try:
                n = int(v)
            except (TypeError, ValueError):
                return None
            lo, hi = DELTA_BOUNDS
            if not (lo <= n <= hi):
                return None
            if n != 0:
                delta[k] = n
        options.append({"label": label, "d": delta})

    if len({json.dumps(o["d"], sort_keys=True) for o in options}) < 2:
        return None

    return {"q": question, "options": options, "generated": True}


def generate(situation_label, axis_a, axis_b):
    """Returns a validated {q, options} dict, or None. Callers fall back to
    the authored TIEBREAKER_QUESTIONS bank in quiz.js."""
    if not ENABLED or axis_a not in VALID_AXES or axis_b not in VALID_AXES:
        return None
    try:
        raw = llm.chat(
            _prompt(situation_label or "just curious how this works", axis_a, axis_b),
            [{"role": "user", "content": "Generate one tie-breaking question."}],
        )
    except Exception:
        return None

    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
    except (TypeError, ValueError):
        return None
    return _validate(parsed)
