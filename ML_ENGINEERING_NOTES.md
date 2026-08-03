# ML/Agentic Engineering — Progress Notes

Tracks the PRD's four items against what's actually built, so the write-up
never outruns the work (per the PRD's own guardrail). Updated as each item
lands.

## 1. Agentic Coaching Chat — done

- **Tool set implemented**: `get_my_profile`, `get_my_recent_decisions`,
  `get_my_axis_consistency`, `get_my_goals`, `search_research_notes` (RAG).
  All in `coach_agent.py`, closed over the authenticated request's `user_id`.
- **Deliberate deviation from the spec**: safeguarding is *not* a callable
  tool, even though the PRD's initial tool list includes it. PAPER.md §7.7
  requires crisis detection to "never fail closed" — an LLM agent can
  simply choose not to call a tool on a given turn, which is exactly the
  failure mode that requirement rules out. Safeguarding stays a
  deterministic Python check in `server.py` that runs before either engine
  (direct or agent) and is threaded into the reply the same way for both.
  This is a stronger design than the spec asked for, not a shortcut — call
  it out this way if it comes up.
- **Model decides tool use from conversation context**, via
  `langchain.agents.create_agent` (LangChain 1.x, built on LangGraph) — not
  a hardcoded call sequence. `demo_agent_trace.py` produces a real, runnable
  trace of this (script below).
- **Every tool call is logged and queryable**: `agent_tool_calls` table
  (`db.py`), written by `coach_agent.ToolCallLogger` (a LangChain callback
  handler, not per-tool edits — logging can't drift out of sync as tools
  are added). Queryable via `GET /api/admin/agent-tool-calls` (admin-gated)
  or `db.get_recent_agent_tool_calls()`.
- **Graceful degradation, verified two ways**: (a) each tool wraps its own
  DB call in try/except — a direct test confirmed an unhandled tool
  exception propagates out of `agent.invoke()` and would otherwise end the
  conversation; (b) the whole agent path falls back to `AgentUnavailable`
  → the same 503 path as the direct engine, if langchain isn't installed,
  the API key is missing, or the model call itself fails.
- **Single-agent only** — no multi-agent orchestration, per the PRD's own
  guardrail.

**Interview evidence**: `python demo_agent_trace.py` — real `create_agent`
graph, real tool execution against a real seeded user, real row written to
`agent_tool_calls`, printed at the end. The model's decision to call a tool
is scripted (the real `ANTHROPIC_API_KEY` is currently tied to a disabled
org — see git history), but everything downstream of that decision is real
and unmodified from the production code path. Swapping in a working key
requires no code changes to this script.

Tests: `tests/test_chat_agent.py` (28 tests — tool logic, logging, graceful
degradation, admin endpoint, recursion limit), `tests/test_rag.py` (6 tests
— retrieval).

### Deploy-readiness — closed 3 of the 6 blockers identified when asked
"what's preventing this from being production ready":

1. ~~Dead `ANTHROPIC_API_KEY`~~ — **not fixable from here**, still open.
   The org tied to the leaked key is disabled; needs manual resolution at
   console.anthropic.com, then the new key set in Railway's env vars.
2. ~~`requirements-agent.txt` never installed on Railway~~ — **fixed**.
   `nixpacks.toml`'s install phase now installs both requirement files, so
   `LLM_ENGINE=agent` can be turned on via a Railway env var alone, no
   redeploy needed to add the dependency. Tradeoff: larger image / slower
   build even while the agent engine stays off, documented inline.
3. ~~RAG index has no production home~~ — **fixed**. Restructured the
   build so it no longer needs Node at deploy time: `rag/build_corpus.js`
   is now a dev-time step whose output (`rag/corpus_js.json`) is committed
   to git, and `rag/build_index.py` reads that committed snapshot rather
   than shelling out to Node. `nixpacks.toml`'s build phase runs
   `python -m rag.build_index`, baking the index (and the embedding
   model's one-time download) into the deployed image instead of a live
   request's cold start.
4. ~~Never tested against the real model~~ — **still open**, blocked on
   (1). `demo_agent_trace.py` proves everything downstream of the model's
   tool-call decision; the decision itself needs a real key to verify.
5. ~~No bound on the tool-calling loop~~ — **fixed**. `agent.invoke()` now
   sets an explicit `recursion_limit` (`AGENT_RECURSION_LIMIT` env var,
   default 15 — roughly 5-7 tool calls' worth of headroom). Verified two
   ways: a real `GraphRecursionError` from an intentionally-looping fake
   model gets caught by the existing `AgentUnavailable` handling, and a
   mocked `create_agent` confirms the configured limit is what actually
   reaches `.invoke()`, not just a defined-but-unused constant.
6. No monitoring beyond `app.logger.warning()` — **still open**, not
   started. Lowest priority of the six; nothing to alert on until (1)/(4)
   land and the agent engine is actually live for real traffic.

None of 2/3/5 have been verified against a real Railway deploy — I don't
have deploy access. They're correct as far as local testing can confirm
(nixpacks.toml's syntax, `rag.build_index` running clean, the recursion
limit actually reaching `.invoke()`); treat the next real Railway deploy as
the first real verification of the build config specifically.

## 2. Predictive Models on Product Data — in progress

Not started as of this note. Next up.

## 3. Archetype Matcher Rebuild — not started

## 4. MLOps Extension — not started

Deliberately sequenced last per the PRD: nothing to version or monitor
until at least one real trained model exists (item 2 or 3).
