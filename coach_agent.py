"""
LangChain tool-using agent variant of the coaching chat.

coach.py's build_system_prompt() bakes one big static context block into the
system prompt, built from whatever "context" blob the CLIENT chooses to send
in the request body (see server.py's chat() — every field is bounds-checked,
but the server never independently verifies any of it against the database).
This module is a second, swappable engine (LLM_ENGINE=agent) that gives the
coach real tools instead: it looks up the SIGNED-IN user's actual profile,
decision history, axis consistency, and goals from the database itself, on
demand, rather than trusting a client-supplied summary. Anonymous users still
work — the tools just report "not signed in" and the coach falls back to
the conversation alone, same as coach.py already does when context is empty.

Safeguarding is deliberately NOT exposed as a tool. PAPER.md §7.7 states
detection "cannot fail closed" — an LLM agent deciding whether to call a
tool is exactly the failure mode that commitment rules out, since the model
could simply choose not to call it on a given turn. Safeguarding stays the
same deterministic Python check in server.py that always runs before either
engine, direct or agent, and its result is threaded into the reply the same
way for both.

Setup:
    pip install -r requirements-agent.txt

Enable:
    LLM_ENGINE=agent  (server.py falls back to the direct llm.py path if
    this isn't set, or if langchain/langchain-anthropic aren't installed —
    see AgentUnavailable below.)
"""

import os

import coach
import db

_AGENT_MODEL = os.environ.get("LLM_MODEL", "claude-haiku-4-5-20251001")
_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "400"))


class AgentUnavailable(Exception):
    """Raised when the agent can't run for any reason — package not
    installed, no API key, the underlying call failed. Callers should treat
    this exactly like llm.LLMError and degrade the same way (server.py's
    chat() already has that fallback path)."""


def _require_langchain():
    try:
        from langchain.agents import create_agent
        from langchain_anthropic import ChatAnthropic
        from langchain_core.tools import tool
    except ImportError as err:
        raise AgentUnavailable(
            "langchain / langchain-anthropic not installed — "
            "pip install -r requirements-agent.txt"
        ) from err
    return create_agent, ChatAnthropic, tool


def _build_tools(user_id, tool_decorator):
    """Tools closed over this request's authenticated user_id, so the model
    can only ever look up the person it's actually talking to — there is no
    "whose data" argument for it to get wrong, by construction, not by
    prompt instruction."""

    @tool_decorator
    def get_my_profile() -> str:
        """Look up the user's six-axis behavioural profile and matched
        archetype from their most recent quiz/assessment. Call this if you
        need to know their archetype or a specific axis score to answer
        what they're asking — not for generic small talk."""
        profile = db.get_user_profile(user_id) if user_id else None
        if not profile or not isinstance(profile.get("profile"), dict):
            return "No saved profile yet — they haven't taken the quiz, or aren't signed in."
        axes = profile["profile"]
        lines = [f"archetype: {profile.get('archetype') or 'not yet matched'}"]
        lines += [f"{axis}: {round(v)}/100" for axis, v in axes.items()]
        if profile.get("capability") is not None:
            lines.append(f"capability index: {round(profile['capability'])}/100")
        return "; ".join(lines)

    @tool_decorator
    def get_my_recent_decisions(count: int = 5) -> str:
        """Look up the user's most recent practice-sandbox decisions — the
        wellbeing score and zone (breakdown / homeostasis / distortion)
        after each one. Call this if they ask about a recent decision, a
        pattern in their choices, or how their numbers have been moving."""
        if not user_id:
            return "Not signed in — no server-side decision history available."
        history = db.get_wellbeing_history(user_id)
        if not history:
            return "No recorded decisions yet."
        recent = history[-max(1, min(count, 20)):]
        return "; ".join(
            f"wellbeing {round(h['wellbeing'])}, {h['zone'] or 'unknown zone'}"
            for h in recent
        )

    @tool_decorator
    def get_my_axis_consistency() -> str:
        """Look up how consistent the user's decisions have been on each
        behavioural axis — low variance means they behave the same way each
        time on that axis, high variance means erratic. Call this if they
        ask whether they're being consistent, or which area is shakiest."""
        if not user_id:
            return "Not signed in — no server-side consistency data available."
        consistency = db.get_axis_consistency(user_id)
        if not consistency:
            return "Not enough axis-tagged decisions yet to compute this."
        return "; ".join(
            f"{axis}: {v['count']} decisions, avg wellbeing {v['avg_wellbeing']}, variance {v['variance']}"
            for axis, v in consistency.items()
        )

    @tool_decorator
    def get_my_goals() -> str:
        """Look up the user's stated financial goals and whether each is
        marked done. Call this if they mention a goal or ask about progress
        toward one."""
        if not user_id:
            return "Not signed in — no saved goals available."
        goals = db.get_user_goals(user_id)
        if not goals:
            return "No goals saved yet."
        return "; ".join(
            f"{g.get('title', 'untitled')}{' (done)' if g.get('done') else ''}"
            for g in goals if isinstance(g, dict)
        ) or "No goals saved yet."

    return [get_my_profile, get_my_recent_decisions, get_my_axis_consistency, get_my_goals]


def _system_prompt(slug, scenario=None):
    """Same guardrails / homeostasis briefing / persona voice as coach.py's
    static prompt — reused, not reimplemented — minus the client-supplied
    context block, since the agent fetches its own context via tools."""
    persona = coach.PERSONAS.get(slug)
    if not persona:
        return None
    name, trait, voice = persona
    prompt = (
        f"{coach.SHARED_GUARDRAILS}"
        f"{coach.HOMEOSTASIS_BRIEFING}"
        f"\nYOUR PERSONA: You are '{name}' — {trait}.\n{voice}\n"
        "\nYou have tools to look up this person's own saved data (profile, recent "
        "decisions, axis consistency, goals). Use a tool when it would genuinely help "
        "answer what they're asking — not on every turn, and never announce that you're "
        "'checking' or 'looking something up'; just use what you find naturally, the way "
        "a coach who already knows the person would.\n"
        f"\nSpeak in character as {name} throughout, but never let the persona override "
        "the strict rules above."
    )
    _drift, gap_text = coach.ARCHETYPE_GAPS.get(slug, (None, None))
    if gap_text:
        prompt += f"\n\nThis archetype's characteristic risk: {gap_text}."
    if scenario:
        prompt += coach.DECISION_COACHING
        opts = "\n".join(f"  - {o}" for o in scenario.get("options", [])[:4])
        prompt += (
            f"\n\nTHE DECISION IN FRONT OF THEM:\n\"{scenario.get('text', '')}\"\n"
            f"Their options are:\n{opts}\nRefer to these naturally, do not repeat them as a list."
        )
    return prompt


def run(slug, user_id, messages, scenario=None, extra_system=None):
    """Runs the tool-using agent for one turn.

    `messages` is the same [{"role", "content"}, ...] shape server.py already
    sanitizes for the direct (llm.chat) path. `extra_system`, if given, is
    appended to the system prompt as-is — server.py uses this for
    safeguarding.coach_instruction(), the same augmentation the direct path
    applies to its own system prompt. Returns the reply text, or raises
    AgentUnavailable for the caller to degrade on — same contract as
    llm.LLMError, so server.py's existing except block covers both engines.
    """
    create_agent, ChatAnthropic, tool_decorator = _require_langchain()

    system_prompt = _system_prompt(slug, scenario=scenario)
    if system_prompt is None:
        raise AgentUnavailable(f"unknown persona: {slug}")
    if extra_system:
        system_prompt += extra_system

    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise AgentUnavailable("ANTHROPIC_API_KEY not set")

    tools = _build_tools(user_id, tool_decorator)
    model = ChatAnthropic(model=_AGENT_MODEL, api_key=key, max_tokens=_MAX_TOKENS)
    agent = create_agent(model, tools=tools, system_prompt=system_prompt)

    try:
        result = agent.invoke({"messages": messages})
    except Exception as err:  # noqa: BLE001 — any provider/network failure degrades the same way
        raise AgentUnavailable(f"agent run failed: {err}") from err

    for m in reversed(result.get("messages", [])):
        if getattr(m, "type", None) == "ai" and isinstance(getattr(m, "content", None), str):
            return m.content.strip()
    return ""
