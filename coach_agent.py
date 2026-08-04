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

A fifth tool, search_research_notes, is retrieval-augmented generation: it
searches a local vector index (rag/) built from this app's own curated
behavioral-finance content — idm.js's belief citations, learn.js's lesson
research, and PAPER.md's literature review — so the coach can ground an
answer in the app's actual sources instead of the model's parametric
knowledge alone (which, for citations specifically, is exactly where a
model is most likely to confabulate a plausible-sounding reference).

Every tool call is logged to the agent_tool_calls table (db.py) via a
LangChain callback handler (ToolCallLogger below) — not by editing each
tool body, so logging can't drift out of sync as tools are added or
changed. This is the queryable trace that makes "the model decided to
check X before answering" a demonstrable fact rather than a claim: see
get_recent_agent_tool_calls() / GET /api/admin/agent-tool-calls.

Each tool also wraps its own body in try/except, independent of the
logger — a tool raising must degrade to a returned string the model can
still respond around, not an exception that aborts the whole turn. This
is deliberately not left to the framework's default error handling: a
direct test confirmed a tool exception still propagates out of
agent.invoke() and would end the conversation with a 503 unless each
tool catches its own failures explicitly.

Observability: every agent.invoke() call is tagged with a run name, the
persona, and whether a scenario is attached (see run()'s config dict
below), and traced to LangSmith whenever LANGSMITH_TRACING=true and a
valid LANGSMITH_API_KEY are set — the actual tool-call sequence, timing,
and token usage per turn, viewable at smith.langchain.com, not just what
agent_tool_calls' summary rows capture. Deliberately NOT required: with
tracing env vars unset (the default), langsmith no-ops silently, and even
a bad/expired key only logs a background "Failed to multipart ingest
runs" warning to stderr — verified directly, this never blocks or breaks
the actual reply, so there's no reason this needs to be gated behind
AgentUnavailable the way a broken model call does.

Setup:
    pip install -r requirements-agent.txt
    python -m rag.build_index   # builds rag/chroma_db/ — one-time, or after
                                # editing idm.js/learn.js/PAPER.md content

Enable:
    LLM_ENGINE=agent  (server.py falls back to the direct llm.py path if
    this isn't set, or if langchain/langchain-anthropic aren't installed —
    see AgentUnavailable below.)

Enable tracing (optional, separate from the above):
    LANGSMITH_TRACING=true
    LANGSMITH_API_KEY=...       # from smith.langchain.com — a real account,
                                 # not something this code can create for you
    LANGSMITH_PROJECT=finperson # optional, groups traces in the LangSmith UI
"""

import os

import coach
import db

_AGENT_MODEL = os.environ.get("LLM_MODEL", "claude-haiku-4-5-20251001")
_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "400"))


def tracing_enabled():
    """Whether this run will actually be traced to LangSmith — both the
    opt-in flag and a key have to be present; a flag with no key would
    just produce the background-warning behavior described above, not a
    real trace, so callers reporting status (chat_info()) should check
    this rather than the flag alone."""
    flag = os.environ.get("LANGSMITH_TRACING") or os.environ.get("LANGCHAIN_TRACING_V2")
    key = os.environ.get("LANGSMITH_API_KEY") or os.environ.get("LANGCHAIN_API_KEY")
    return bool(flag and flag.lower() == "true" and key)

# LangGraph's create_agent has no product-chosen bound on this by default —
# it runs on the library's own implicit recursion_limit, not a number picked
# for this app. Each model turn and each tool execution is one graph step,
# so 15 gives headroom for roughly 5-7 tool calls in a single reply before
# the run is cut off — generous for a coach that's meant to call 0-2 tools
# per turn (see _system_prompt's "not on every turn" instruction), but a
# real ceiling on the worst case: a conversation that somehow induces
# excessive back-and-forth tool calling has a bounded cost and latency
# instead of an open-ended one.
_RECURSION_LIMIT = int(os.environ.get("AGENT_RECURSION_LIMIT", "15"))


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


def _tool_call_logger_class():
    """LangChain's BaseCallbackHandler is itself behind the lazy import
    (langchain_core), so this is built the same way _require_langchain()
    builds everything else — a factory, not a module-level class, so
    importing coach_agent.py never requires langchain to be installed."""
    from langchain_core.callbacks import BaseCallbackHandler

    class ToolCallLogger(BaseCallbackHandler):
        """Writes every tool call this run makes to agent_tool_calls
        (db.py) — start, end, and error are three separate LangChain
        callback events, so on_tool_start stashes the input and the actual
        row is written on whichever of on_tool_end / on_tool_error fires.
        A logging failure must never break the conversation either, so
        every write is its own try/except, silently dropped on failure —
        losing one trace row is fine; crashing the chat over telemetry is
        not."""

        def __init__(self, run_id, user_id, persona):
            self.run_id = run_id
            self.user_id = user_id
            self.persona = persona
            self._pending = {}  # run_id (LangChain's, per-tool-call) -> (tool_name, input)

        def on_tool_start(self, serialized, input_str, *, run_id, **kwargs):
            name = (serialized or {}).get("name", "unknown_tool")
            self._pending[run_id] = (name, kwargs.get("inputs", input_str))

        def on_tool_end(self, output, *, run_id, **kwargs):
            name, tool_input = self._pending.pop(run_id, ("unknown_tool", None))
            # Inside the full agent graph (as opposed to invoking a bare
            # tool directly), `output` is the ToolMessage the graph wraps
            # the return value in, not the plain string the tool returned —
            # unwrap it so the log stores what the tool actually said.
            content = getattr(output, "content", output)
            try:
                db.log_agent_tool_call(
                    self.run_id, self.user_id, self.persona, name,
                    tool_input, content, status="ok",
                )
            except Exception:  # noqa: BLE001 — telemetry must never break the chat
                pass

        def on_tool_error(self, error, *, run_id, **kwargs):
            name, tool_input = self._pending.pop(run_id, ("unknown_tool", None))
            try:
                db.log_agent_tool_call(
                    self.run_id, self.user_id, self.persona, name,
                    tool_input, None, status="error", error_message=str(error),
                )
            except Exception:  # noqa: BLE001
                pass

    return ToolCallLogger


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
        try:
            profile = db.get_user_profile(user_id) if user_id else None
            if not profile or not isinstance(profile.get("profile"), dict):
                return "No saved profile yet — they haven't taken the quiz, or aren't signed in."
            axes = profile["profile"]
            lines = [f"archetype: {profile.get('archetype') or 'not yet matched'}"]
            lines += [f"{axis}: {round(v)}/100" for axis, v in axes.items()]
            if profile.get("capability") is not None:
                lines.append(f"capability index: {round(profile['capability'])}/100")
            return "; ".join(lines)
        except Exception:  # noqa: BLE001 — a tool failure must degrade, not abort the turn
            return "Couldn't look up their profile right now."

    @tool_decorator
    def get_my_recent_decisions(count: int = 5) -> str:
        """Look up the user's most recent practice-sandbox decisions — the
        wellbeing score and zone (breakdown / homeostasis / distortion)
        after each one. Call this if they ask about a recent decision, a
        pattern in their choices, or how their numbers have been moving."""
        try:
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
        except Exception:  # noqa: BLE001
            return "Couldn't look up their decision history right now."

    @tool_decorator
    def get_my_axis_consistency() -> str:
        """Look up how consistent the user's decisions have been on each
        behavioural axis — low variance means they behave the same way each
        time on that axis, high variance means erratic. Call this if they
        ask whether they're being consistent, or which area is shakiest."""
        try:
            if not user_id:
                return "Not signed in — no server-side consistency data available."
            consistency = db.get_axis_consistency(user_id)
            if not consistency:
                return "Not enough axis-tagged decisions yet to compute this."
            return "; ".join(
                f"{axis}: {v['count']} decisions, avg wellbeing {v['avg_wellbeing']}, variance {v['variance']}"
                for axis, v in consistency.items()
            )
        except Exception:  # noqa: BLE001
            return "Couldn't compute axis consistency right now."

    @tool_decorator
    def get_my_goals() -> str:
        """Look up the user's stated financial goals and whether each is
        marked done. Call this if they mention a goal or ask about progress
        toward one."""
        try:
            if not user_id:
                return "Not signed in — no saved goals available."
            goals = db.get_user_goals(user_id)
            if not goals:
                return "No goals saved yet."
            return "; ".join(
                f"{g.get('title', 'untitled')}{' (done)' if g.get('done') else ''}"
                for g in goals if isinstance(g, dict)
            ) or "No goals saved yet."
        except Exception:  # noqa: BLE001
            return "Couldn't look up their goals right now."

    @tool_decorator
    def search_research_notes(query: str) -> str:
        """Search this app's own curated behavioral-finance research notes —
        the citations behind the "beliefs being tested" and the Learn
        module's lesson content — for passages relevant to the user's
        question. Call this when they ask why something works the way it
        does, or reference research or psychology, so the answer can be
        grounded in a real source from this app rather than a citation the
        model recalls (and could get wrong) from its own training."""
        try:
            from rag.retriever import IndexNotBuilt, search as rag_search
        except ImportError:
            return "Research notes search isn't set up (pip install -r requirements-agent.txt)."
        try:
            results = rag_search(query, k=3)
        except IndexNotBuilt as err:
            return str(err)
        except Exception:  # noqa: BLE001
            return "Couldn't search research notes right now."
        if not results:
            return "No matching research notes found."
        return "\n".join(f"- ({r['source']}) {r['title']}: {r['text']}" for r in results)

    return [
        get_my_profile, get_my_recent_decisions, get_my_axis_consistency,
        get_my_goals, search_research_notes,
    ]


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
        "decisions, axis consistency, goals), and a separate tool to search this app's "
        "own research notes for the psychology behind a pattern. Use a tool when it would "
        "genuinely help answer what they're asking — not on every turn, and never announce "
        "that you're 'checking' or 'looking something up'; just use what you find "
        "naturally, the way a coach who already knows the person and the material would. "
        "If you reference a study or finding, prefer what search_research_notes returns "
        "over your own recollection — if the tool has nothing relevant, speak generally "
        "and do not invent a citation.\n"
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
    import uuid

    create_agent, ChatAnthropic, tool_decorator = _require_langchain()
    ToolCallLogger = _tool_call_logger_class()

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

    run_id = str(uuid.uuid4())
    logger = ToolCallLogger(run_id, user_id, slug)
    try:
        result = agent.invoke(
            {"messages": messages},
            config={
                "callbacks": [logger],
                "recursion_limit": _RECURSION_LIMIT,
                # Meaningless when tracing is off (LangSmith no-ops on
                # these), but this is what makes a LangSmith trace
                # filterable/searchable by persona or scenario-vs-plain-chat
                # instead of an undifferentiated list of anonymous runs.
                "run_name": f"coach-{slug}",
                "tags": ["finperson", "coach-agent", slug, "decision-mode" if scenario else "chat-mode"],
                "metadata": {"persona": slug, "signed_in": bool(user_id), "has_scenario": bool(scenario)},
            },
        )
    except Exception as err:  # noqa: BLE001 — any provider/network failure degrades the same way
        raise AgentUnavailable(f"agent run failed: {err}") from err

    for m in reversed(result.get("messages", [])):
        if getattr(m, "type", None) == "ai" and isinstance(getattr(m, "content", None), str):
            return m.content.strip()
    return ""
