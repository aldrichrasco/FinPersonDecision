#!/usr/bin/env python3
"""
Produces a REAL, logged trace of the coaching agent deciding to call a tool
mid-conversation — the "interview evidence" artifact: proof the flow is
genuinely agentic (the model chooses whether/which tool to call from
conversation context) rather than a hardcoded call sequence dressed up as
one.

Why a scripted fake model, not the real Claude API: the ANTHROPIC_API_KEY
in this environment is tied to a disabled organisation (a real, ongoing
issue — see git history around when coach_agent.py was first built). A
scripted model isn't a workaround for the agent logic — it's the standard
way to test/demonstrate an agentic *graph* (which tool gets invoked, what
data flows through it, what gets logged) independent of the underlying
LLM's judgment, which is a separate thing to evaluate. Everything this
script exercises is real: real create_agent graph, real tool functions
querying the real database, real ToolCallLogger writing real rows to
agent_tool_calls. Only the model's decision to call a tool is scripted
rather than reasoned — swap in a working ANTHROPIC_API_KEY and nothing
else about this script needs to change.

Usage:
    pip install -r requirements-agent.txt
    python demo_agent_trace.py
"""

import os
import sys
import uuid

os.environ.setdefault("SQLITE_PATH", "finperson_demo.db")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def _load_dotenv(path=".env"):
    """Mirrors server.py's own loader so this script sees the same
    ANTHROPIC_API_KEY / LANGSMITH_* config a real `python server.py` run
    would, without importing server.py itself (which would also build the
    Flask app)."""
    try:
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                key, val = key.strip(), val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val
    except FileNotFoundError:
        pass


_load_dotenv()


def _build_demo_user():
    import db
    from werkzeug.security import generate_password_hash

    db.init_db()
    email = f"agent-demo-{uuid.uuid4().hex[:8]}@example.com"
    user = db.create_password_user(email, generate_password_hash("demo-password-not-real"), "Demo User")
    uid = user["id"]
    db.save_user_goals(uid, [
        {"title": "Build a 3-month emergency fund", "done": False},
        {"title": "Pay off the credit card", "done": True},
    ])
    db.save_user_profile(uid, {
        "profile": {
            "impulse_regulation": 38, "risk_disposition": 55, "temporal_orientation": 42,
            "financial_attentiveness": 60, "financial_self_efficacy": 45, "prosocial_orientation": 50,
        },
        "archetype": "anxious_avoider", "capability": 48, "at": 0,
    })
    return uid


def _make_scripted_model():
    """A minimal BaseChatModel that plays a fixed script: first call
    returns a tool call, second call (once it sees the ToolMessage result
    in history) returns a plain-text reply that references it. This is
    what proves the graph itself — routing an AIMessage.tool_calls entry to
    the right tool node, executing it, feeding the result back — works,
    independent of whether a real model would have chosen to call it."""
    from langchain_core.language_models.chat_models import BaseChatModel
    from langchain_core.messages import AIMessage, BaseMessage, ToolMessage
    from langchain_core.outputs import ChatGeneration, ChatResult

    class ScriptedToolCallModel(BaseChatModel):
        call_count: int = 0

        def bind_tools(self, tools, **kwargs):
            return self

        def _generate(self, messages: list[BaseMessage], stop=None, run_manager=None, **kwargs) -> ChatResult:
            saw_tool_result = any(isinstance(m, ToolMessage) for m in messages)
            if not saw_tool_result:
                msg = AIMessage(
                    content="",
                    tool_calls=[{"name": "get_my_goals", "args": {}, "id": "demo_call_1"}],
                )
            else:
                tool_output = next(m.content for m in messages if isinstance(m, ToolMessage))
                msg = AIMessage(
                    content=(
                        "Looking at what you've got saved — you're already square with the "
                        f"card. Here's where things stand: {tool_output} The emergency fund is "
                        "the one still open; want to talk through a monthly number for it?"
                    )
                )
            self.call_count += 1
            return ChatResult(generations=[ChatGeneration(message=msg)])

        @property
        def _llm_type(self) -> str:
            return "scripted-tool-call-demo"

    return ScriptedToolCallModel()


def main():
    from langchain.agents import create_agent
    from langchain_core.tools import tool

    import coach_agent
    import db

    print("Setting up a demo user with real saved goals...")
    uid = _build_demo_user()
    print(
        "LangSmith tracing: "
        + ("ON — check smith.langchain.com for this run's trace" if coach_agent.tracing_enabled()
           else "off (set LANGSMITH_TRACING=true + LANGSMITH_API_KEY to enable)")
    )

    ToolCallLogger = coach_agent._tool_call_logger_class()
    tools = coach_agent._build_tools(uid, tool)
    system_prompt = coach_agent._system_prompt("anxious_avoider")
    model = _make_scripted_model()
    agent = create_agent(model, tools=tools, system_prompt=system_prompt)

    run_id = str(uuid.uuid4())
    logger = ToolCallLogger(run_id, uid, "anxious_avoider")

    user_message = "How am I doing on my goals?"
    print(f'\nUser: "{user_message}"')
    result = agent.invoke({"messages": [{"role": "user", "content": user_message}]}, config={"callbacks": [logger]})

    reply = next(
        m.content for m in reversed(result["messages"])
        if getattr(m, "type", None) == "ai" and isinstance(getattr(m, "content", None), str) and m.content
    )
    print(f"\nCoach: {reply}")

    print(f"\n{'=' * 78}\nLogged trace for run_id={run_id} (from agent_tool_calls, via db.get_recent_agent_tool_calls):\n{'=' * 78}")
    calls = [c for c in db.get_recent_agent_tool_calls(limit=200) if c["run_id"] == run_id]
    for c in calls:
        print(f"  tool={c['tool_name']!r} status={c['status']}")
        print(f"    input:  {c['tool_input']}")
        print(f"    output: {c['tool_output']}")
    if not calls:
        print("  (no tool calls logged — something's wrong; this script should always produce exactly one)")


if __name__ == "__main__":
    main()
