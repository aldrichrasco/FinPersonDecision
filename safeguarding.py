"""
Safeguarding.

A financial capability tool meets people in real difficulty. This module
detects signals that someone may need help beyond an educational coach, and
makes sure they are pointed toward it.

DESIGN NOTES

1. Detection is deliberately HIGH-RECALL and LOW-PRECISION. A false positive
   costs a gentle, easily-dismissed offer of support. A false negative costs
   someone in crisis being handed budgeting tips. Those are not symmetric.

2. Detection NEVER blocks the conversation. The coach still replies; the
   safeguarding response is added alongside. Being cut off mid-sentence when
   you have just disclosed something hard is its own harm.

3. Nothing here is diagnosis. We detect *language*, not conditions, and the
   response is always "here is who can actually help", never "you have X".

4. Signals are counted, never stored verbatim. We record that a category
   fired, not what the person wrote.

!! BEFORE DEPLOYMENT !!
   The "nz" region's phone numbers are filled in and were verified against
   each organisation's own site (see the note at the end of RESOURCES for the
   date) — re-verify before a real deployment, numbers do change.
   The "generic" region's phone field is intentionally left blank: it points
   to findahelpline.com, a directory that redirects to the right number per
   country, so there is no single global number to fill in. If you add a
   region for a specific country, verify every contact detail yourself before
   users depend on it — a wrong crisis number is worse than none. Set
   SAFEGUARDING_REGION to pick which block RESOURCES uses.
"""

import os
import re

REGION = os.environ.get("SAFEGUARDING_REGION", "generic").lower()

# Categories are ordered by severity. The first match at the highest severity
# determines the response shown.
SEVERITY_CRISIS = "crisis"      # risk to life — always escalate hardest
SEVERITY_URGENT = "urgent"      # acute harm: coercion, addiction, destitution
SEVERITY_SUPPORT = "support"    # serious money difficulty needing real advice

# Word-boundary patterns, lowercased input. Kept readable so they can be
# reviewed by non-engineers — a safeguarding list should be auditable.
SIGNALS = [
    (SEVERITY_CRISIS, "self_harm", [
        r"\bkill(ing)? myself\b", r"\bend (my|it) (life|all)\b", r"\bsuicid",
        r"\bwant to die\b", r"\bno reason to (live|go on)\b",
        r"\bdon'?t want to (live|be here|wake up|exist)\b",
        r"\bdo not want to (live|be here)\b",
        r"\bwish i (was|were) (dead|gone)\b", r"\bwant it to (stop|end)\b",
        r"\bcan'?t see a way out\b", r"\bnothing left to live for\b",
        r"\bbetter off (dead|without me)\b", r"\bharm myself\b",
        r"\bnot worth living\b", r"\bcan'?t (go on|do this any ?more)\b",
    ]),
    (SEVERITY_URGENT, "coercion", [
        r"\b(partner|husband|wife|boyfriend|girlfriend|family|they|he|she) (controls?|manages? all|won'?t let me|will not let me)\b",
        r"\bwon'?t let me (access|touch|use|see|have|spend)\b",
        r"\bnot allowed to (spend|access|see|work|have)\b",
        r"\bhas to approve (my|every)\b", r"\bchecks? everything i (spend|buy)\b", r"\bhides? the money\b",
        r"\btakes? my (wages|money|benefits)\b", r"\bfinancial(ly)? abus",
        r"\bmade me take out\b", r"\bforced me to (borrow|sign)\b",
    ]),
    (SEVERITY_URGENT, "gambling", [
        r"\bgambl", r"\bbetting\b", r"\bcasino\b", r"\bslots?\b",
        r"\bchasing (my )?losses\b", r"\bcan'?t stop (betting|playing)\b",
    ]),
    (SEVERITY_URGENT, "destitution", [
        r"\bcan'?t afford (food|to eat|to feed)\b", r"\bfood ?bank\b",
        r"\b(not|haven'?t been|stopped|skip(ping)?) (eating(?!\s+out)|meals)\b",
        r"\bskip(ping)? meals\b", r"\bgo(ing)? without (food|meals|eating)\b",
        r"\bso (the|my) (kids|children) can eat\b",
        r"\bbeing evicted\b", r"\beviction\b", r"\bhomeless\b",
        r"\bno (money|food) (for|until)\b", r"\bheating or eating\b",
        r"\bcut off my (electricity|gas|power|water)\b",
    ]),
    (SEVERITY_SUPPORT, "debt_crisis", [
        r"\bbailiff", r"\bdebt collector", r"\bcourt (order|summons)\b",
        r"\brepossess", r"\bdefault(ed)? on\b", r"\bcan'?t (pay|make) (the )?(rent|mortgage)\b",
        r"\bpayday loan", r"\bloan shark", r"\bdrowning in debt\b",
        r"\bdebt is (crushing|killing)\b",
    ]),
]

# Compiled once at import.
_COMPILED = [
    (sev, cat, [re.compile(p, re.IGNORECASE) for p in pats])
    for sev, cat, pats in SIGNALS
]

# ---------------------------------------------------------------------------
# Resources. Organisation names + public URLs only. PHONE NUMBERS DELIBERATELY
# BLANK — fill in verified numbers for your region before going live.
# ---------------------------------------------------------------------------
RESOURCES = {
    "generic": {
        "crisis": [
            {"name": "Find a Helpline", "url": "https://findahelpline.com",
             "note": "Free, confidential crisis lines in over 130 countries.", "phone": ""},
        ],
        "urgent": [
            {"name": "Find a Helpline", "url": "https://findahelpline.com",
             "note": "Search by country and topic.", "phone": ""},
        ],
        "support": [
            {"name": "A local non-profit debt advice service", "url": "",
             "note": "Free debt advice is available in most countries — never pay for it.", "phone": ""},
        ],
    },
    "nz": {
        "crisis": [
            {"name": "1737 — Need to Talk?", "url": "https://1737.org.nz",
             "note": "Free call or text, any time, to talk with a trained counsellor.", "phone": "1737"},
            {"name": "Lifeline Aotearoa", "url": "https://www.lifeline.org.nz",
             "note": "24/7 helpline.", "phone": "0800 543 354"},
        ],
        "urgent": [
            {"name": "Gambling Helpline", "url": "https://gamblinghelpline.co.nz",
             "note": "Free, 24/7. Text 8006.", "phone": "0800 654 655"},
            {"name": "Shine (family harm)", "url": "https://www.2shine.org.nz",
             "note": "Support including financial abuse. Free, 24/7.", "phone": "0508 744 633"},
        ],
        "support": [
            {"name": "MoneyTalks", "url": "https://www.moneytalks.co.nz",
             "note": "Free, confidential financial mentoring. Mon-Fri 8am-8pm, weekends shorter hours. Text 4029.",
             "phone": "0800 345 123"},
            {"name": "Citizens Advice Bureau", "url": "https://www.cab.org.nz",
             "note": "Free information and advice.", "phone": "0800 367 222"},
        ],
    },
}
# Verified 2026-07-24 via each organisation's own site/official listing. Phone
# numbers and services can still change — re-verify periodically, especially
# before a fresh deployment, rather than treating this as permanently correct.


def detect(text):
    """
    Returns {"severity", "category"} for the highest-severity signal found,
    or None. Never returns the matched text.
    """
    if not text or not isinstance(text, str):
        return None
    lowered = text.lower()
    order = {SEVERITY_CRISIS: 0, SEVERITY_URGENT: 1, SEVERITY_SUPPORT: 2}
    best = None
    for sev, cat, patterns in _COMPILED:
        if any(p.search(lowered) for p in patterns):
            if best is None or order[sev] < order[best["severity"]]:
                best = {"severity": sev, "category": cat}
    return best


def resources_for(severity):
    region = RESOURCES.get(REGION, RESOURCES["generic"])
    return region.get(severity, region.get("support", []))


def response_for(signal):
    """The message shown alongside the coach's reply."""
    if not signal:
        return None
    sev = signal["severity"]
    if sev == SEVERITY_CRISIS:
        headline = "It sounds like you're going through something really hard."
        body = ("I'm an educational tool, and this is bigger than anything I can help with. "
                "Please talk to someone who can support you properly — they're free, "
                "confidential, and available now.")
    elif sev == SEVERITY_URGENT:
        headline = "This sounds like more than a budgeting problem."
        body = ("There are people who specialise in exactly this and can help "
                "confidentially and for free. I'd rather point you to them than "
                "give you practice scenarios.")
    else:
        headline = "This sounds like a situation worth getting real advice on."
        body = ("Free debt advice exists and is genuinely useful — you should never "
                "have to pay for it. I can keep helping you practise, but please "
                "consider speaking to someone who can look at your actual situation.")
    return {
        "severity": sev,
        "headline": headline,
        "body": body,
        "resources": resources_for(sev),
    }


def coach_instruction(signal):
    """
    Extra system-prompt guidance so the model's own reply is appropriate.
    Layered on top of the standard guardrails.
    """
    if not signal:
        return ""
    if signal["severity"] == SEVERITY_CRISIS:
        return (
            "\n\nSAFEGUARDING — HIGHEST PRIORITY, OVERRIDES YOUR PERSONA:\n"
            "This person may be at risk of harming themselves. Drop the persona voice "
            "and any coaching or scenario framing entirely. Respond briefly, warmly and "
            "plainly as yourself. Acknowledge what they said. Do not offer financial "
            "guidance, do not problem-solve their money, do not use metaphors, and do "
            "not ask them to continue the exercise. Encourage them to contact a crisis "
            "service or someone they trust. Keep it to a few sentences.\n"
        )
    if signal["severity"] == SEVERITY_URGENT:
        return (
            "\n\nSAFEGUARDING — HIGH PRIORITY:\n"
            "This person may be experiencing coercion, addiction, or acute hardship. "
            "Soften the persona considerably. Do not offer budgeting tips or scenarios "
            "as a solution. Acknowledge the seriousness, avoid any suggestion this is "
            "their fault, and support them toward specialist help.\n"
        )
    return (
        "\n\nSAFEGUARDING — NOTE:\n"
        "This person may be in real financial difficulty rather than practising. "
        "Be practical and calm, avoid gamified framing, and make clear that free "
        "debt advice exists.\n"
    )
