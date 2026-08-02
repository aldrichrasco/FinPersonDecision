"""
Tests for coach_agent.py (LLM_ENGINE=agent) and its wiring into server.py.

CI (.github/workflows/ci.yml) only installs requirements.txt, not
requirements-agent.txt -- langchain/langchain-anthropic are NOT guaranteed
to be present when this file runs. Every test here either (a) exercises the
degrade-gracefully contract, which must hold with or without the package
installed, or (b) is explicitly skipped when it isn't. Nothing in this file
should ever require real network access or a working API key -- that's
exactly the boundary coach_agent.AgentUnavailable exists to make testable.
"""

import importlib.util
import os
import sys
import unittest
import unittest.mock
import uuid

import coach_agent
import db
import server

PERSONA = "steady_saver"
_HAS_LANGCHAIN = importlib.util.find_spec("langchain_anthropic") is not None


def _messages(text):
    return {"messages": [{"role": "user", "content": text}]}


class ChatInfoReportsEngineTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_default_engine_is_direct(self):
        response = self.client.get("/api/chat-info")
        self.assertEqual(response.get_json()["engine"], "direct")


class DegradeGracefullyTests(unittest.TestCase):
    """The contract server.py depends on: coach_agent.run() either returns a
    reply or raises AgentUnavailable -- never anything else, regardless of
    whether the package is actually installed in this environment."""

    def test_unknown_persona_raises_agent_unavailable(self):
        with self.assertRaises(coach_agent.AgentUnavailable):
            coach_agent.run("not-a-real-persona", None, [{"role": "user", "content": "hi"}])

    def test_missing_api_key_raises_agent_unavailable(self):
        with unittest.mock.patch.dict(os.environ):
            os.environ.pop("ANTHROPIC_API_KEY", None)
            with self.assertRaises(coach_agent.AgentUnavailable):
                coach_agent.run(PERSONA, None, [{"role": "user", "content": "hi"}])

    def test_missing_package_raises_agent_unavailable(self):
        # sys.modules[name] = None is the standard trick for forcing the next
        # `import name` to raise ImportError, regardless of whether the
        # package is actually installed -- this is what proves server.py's
        # fallback path works even in an environment with no requirements-
        # agent.txt installed, without needing to uninstall anything.
        blocked = {"langchain.agents": None, "langchain_anthropic": None, "langchain_core.tools": None}
        with unittest.mock.patch.dict(sys.modules, blocked):
            with self.assertRaises(coach_agent.AgentUnavailable):
                coach_agent.run(PERSONA, None, [{"role": "user", "content": "hi"}])

    def test_unknown_persona_system_prompt_is_none(self):
        self.assertIsNone(coach_agent._system_prompt("not-a-real-persona"))


class SystemPromptTests(unittest.TestCase):
    """Doesn't need langchain -- _system_prompt() is plain string building."""

    def test_includes_shared_guardrails_and_persona_voice(self):
        import coach

        prompt = coach_agent._system_prompt(PERSONA)
        self.assertIn("NOT a financial advisor", prompt)
        self.assertIn(coach.PERSONAS[PERSONA][0], prompt)  # persona display name

    def test_mentions_tools_without_a_client_context_block(self):
        # The direct engine's build_system_prompt() takes a client-supplied
        # `context` dict; the agent variant deliberately has no equivalent
        # parameter -- it fetches its own context via tools instead.
        prompt = coach_agent._system_prompt(PERSONA)
        self.assertIn("tools to look up this person's own saved data", prompt)

    def test_decision_coaching_mode_includes_the_scenario(self):
        prompt = coach_agent._system_prompt(
            PERSONA, scenario={"text": "Your car needs a $400 repair.", "options": ["Pay from savings", "Put it on credit"]}
        )
        self.assertIn("Your car needs a $400 repair.", prompt)
        self.assertIn("Pay from savings", prompt)
        self.assertIn("do not repeat them as a list", prompt)


@unittest.skipUnless(_HAS_LANGCHAIN, "langchain-anthropic not installed (requirements-agent.txt)")
class ToolLogicTests(unittest.TestCase):
    """The tool functions are what actually replace the client-supplied
    context blob, so their query logic is the part worth verifying directly
    -- independent of whether the LLM ever decides to call them."""

    def setUp(self):
        from langchain_core.tools import tool

        email = f"agent-tools-{uuid.uuid4().hex[:12]}@example.com"
        client = server.app.test_client()
        signup = client.post("/api/auth/signup", json={"email": email, "password": "testpass123"})
        self.assertEqual(signup.status_code, 200)
        with client.session_transaction() as sess:
            self.uid = sess["user_id"]
        self.tools = {t.name: t for t in coach_agent._build_tools(self.uid, tool)}
        self.anon_tools = {t.name: t for t in coach_agent._build_tools(None, tool)}

    def test_profile_tool_reports_no_profile_before_one_is_saved(self):
        self.assertIn("No saved profile yet", self.tools["get_my_profile"].invoke({}))

    def test_profile_tool_reports_saved_profile(self):
        blob = {
            "profile": {
                "impulse_regulation": 70, "risk_disposition": 40, "temporal_orientation": 55,
                "financial_attentiveness": 60, "financial_self_efficacy": 50, "prosocial_orientation": 45,
            },
            "archetype": "cautious_guardian", "capability": 58,
        }
        db.save_user_profile(self.uid, blob)
        result = self.tools["get_my_profile"].invoke({})
        self.assertIn("cautious_guardian", result)
        self.assertIn("impulse_regulation: 70", result)
        self.assertIn("capability index: 58", result)

    def test_recent_decisions_tool_reports_none_yet(self):
        self.assertIn("No recorded decisions yet", self.tools["get_my_recent_decisions"].invoke({}))

    def test_goals_tool_reports_none_yet(self):
        self.assertIn("No goals saved yet", self.tools["get_my_goals"].invoke({}))

    def test_goals_tool_reports_saved_goals(self):
        db.save_user_goals(self.uid, [{"title": "Emergency fund", "done": False}, {"title": "Pay off card", "done": True}])
        result = self.tools["get_my_goals"].invoke({})
        self.assertIn("Emergency fund", result)
        self.assertIn("Pay off card (done)", result)

    def test_anonymous_tools_report_not_signed_in(self):
        self.assertIn("Not signed in", self.anon_tools["get_my_recent_decisions"].invoke({}))
        self.assertIn("Not signed in", self.anon_tools["get_my_axis_consistency"].invoke({}))
        self.assertIn("Not signed in", self.anon_tools["get_my_goals"].invoke({}))
        # Profile tool phrases anonymous the same as no-profile-yet, since
        # both cases mean db.get_user_profile is never called with a real id.
        self.assertIn("No saved profile yet", self.anon_tools["get_my_profile"].invoke({}))


class ChatRouteAgentEngineTests(unittest.TestCase):
    """End-to-end through the Flask route with LLM_ENGINE=agent. Tolerant of
    both 200 (agent actually reached the model) and 503 (model/network
    unavailable in this environment) -- same pattern as
    test_chat_paywall.py's test_not_gated_by_the_paywall. What must NOT
    happen is a 402 (paywall) for a subscribed user, or a 500 (unhandled
    crash) regardless of engine."""

    def setUp(self):
        self.client = server.app.test_client()
        email = f"agent-route-{uuid.uuid4().hex[:12]}@example.com"
        signup = self.client.post("/api/auth/signup", json={"email": email, "password": "testpass123"})
        self.assertEqual(signup.status_code, 200)
        with self.client.session_transaction() as sess:
            self.uid = sess["user_id"]
        db.upsert_subscription(
            user_id=self.uid, provider="stripe", provider_customer_id="cus_test",
            provider_subscription_id=f"sub_test_{uuid.uuid4().hex[:12]}",
            plan="supporter", status="active", current_period_end=None,
        )

    def test_agent_engine_never_500s_and_never_paywalls_a_subscriber(self):
        with unittest.mock.patch.object(server, "LLM_ENGINE", "agent"):
            response = self.client.post(f"/api/chat/{PERSONA}", json=_messages("What should I keep in mind about saving?"))
        self.assertNotEqual(response.status_code, 402)
        self.assertNotEqual(response.status_code, 500)
        self.assertIn(response.status_code, (200, 503))

    def test_safeguarding_still_bypasses_the_paywall_under_the_agent_engine(self):
        # Safeguarding must reach the same place regardless of engine -- this
        # is the property coach_agent.py's docstring calls out explicitly:
        # detection itself is never a tool call, so it can't be skipped by
        # either engine choosing not to invoke it.
        client = server.app.test_client()  # anonymous, no subscription
        with unittest.mock.patch.object(server, "LLM_ENGINE", "agent"):
            response = client.post(f"/api/chat/{PERSONA}", json=_messages("I don't want to live anymore"))
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["reply"], "")
        self.assertEqual(data["safeguarding"]["severity"], "crisis")


if __name__ == "__main__":
    unittest.main()
