"""
Tests for the free RAG companion (POST /api/ask) and its Q&A log.

Retrieval itself is mocked here so the suite never has to load the ~130MB
embedding model or depend on a built index — the real retrieval behaviour
(including the measured relevance threshold) is covered in test_rag.py.
What's under test here is the endpoint contract: validation, the
grounded/ungrounded split, citation shape, safeguarding, and logging.
"""

import unittest
import unittest.mock

import db
import server


def _fake_found(grounded=True, top=0.44):
    return {
        "grounded": grounded,
        "top_score": top,
        "results": [
            {"title": "Present bias", "source": "PAPER.md", "text": "An immediate cost feels heavier..."},
        ] if grounded else [],
    }


class AskValidationTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_rejects_non_dict_body(self):
        r = self.client.post("/api/ask", data=b"nope", content_type="application/json")
        self.assertEqual(r.status_code, 400)

    def test_rejects_empty_question(self):
        r = self.client.post("/api/ask", json={"question": "   "})
        self.assertEqual(r.status_code, 400)

    def test_missing_question_is_rejected(self):
        r = self.client.post("/api/ask", json={})
        self.assertEqual(r.status_code, 400)


class AskRetrievalTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def _post(self, body, found):
        import rag.retriever
        with unittest.mock.patch.object(rag.retriever, "grounded_answer", return_value=found):
            return self.client.post("/api/ask", json=body)

    def test_grounded_answer_returns_sources_with_titles(self):
        r = self._post({"question": "what is present bias"}, _fake_found())
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertTrue(data["grounded"])
        self.assertEqual(data["sources"][0]["source"], "PAPER.md")
        self.assertEqual(data["sources"][0]["title"], "Present bias")

    def test_ungrounded_question_returns_no_sources_and_says_so(self):
        r = self._post({"question": "how do I bake sourdough"}, _fake_found(grounded=False, top=1.09))
        data = r.get_json()
        self.assertFalse(data["grounded"])
        self.assertEqual(data["sources"], [])

    def test_no_generated_prose_is_ever_returned(self):
        # The whole point of the free tier: retrieval only, zero LLM cost.
        r = self._post({"question": "what is present bias"}, _fake_found())
        data = r.get_json()
        self.assertNotIn("reply", data)
        self.assertNotIn("answer", data)

    def test_invalid_persona_is_dropped_not_rejected(self):
        r = self._post({"question": "present bias", "persona": "not_a_persona"}, _fake_found())
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.get_json()["persona"])

    def test_valid_persona_is_echoed_back(self):
        r = self._post({"question": "present bias", "persona": "anxious_avoider"}, _fake_found())
        self.assertEqual(r.get_json()["persona"], "anxious_avoider")

    def test_persona_does_not_change_which_sources_come_back(self):
        found = _fake_found()
        a = self._post({"question": "present bias"}, found).get_json()
        b = self._post({"question": "present bias", "persona": "anxious_avoider"}, found).get_json()
        self.assertEqual(a["sources"], b["sources"])

    def test_long_question_is_truncated_not_rejected(self):
        r = self._post({"question": "x" * 5000}, _fake_found())
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.get_json()["question"]), server.MAX_ASK_CHARS)

    def test_safeguarding_signal_is_attached(self):
        # Safeguarding must run here too — never gated, same as chat().
        with unittest.mock.patch.object(server.safeguarding, "detect", return_value={"severity": "high", "category": "self_harm"}):
            r = self._post({"question": "something distressing"}, _fake_found(grounded=False))
        self.assertIn("safeguarding", r.get_json())

    def test_no_safeguarding_key_on_an_ordinary_question(self):
        r = self._post({"question": "what is present bias"}, _fake_found())
        self.assertNotIn("safeguarding", r.get_json())


class AskLoggingTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_question_is_logged_with_persona_and_sources(self):
        import rag.retriever
        marker = "logged-question-marker-xyz"
        with unittest.mock.patch.object(rag.retriever, "grounded_answer", return_value=_fake_found()):
            self.client.post("/api/ask", json={
                "question": marker, "persona": "steady_saver", "session_id": "sess-1",
            })
        entry = next((e for e in db.get_rag_qa_log(limit=50) if e["question"] == marker), None)
        self.assertIsNotNone(entry)
        self.assertEqual(entry["persona"], "steady_saver")
        self.assertEqual(entry["session_id"], "sess-1")
        self.assertTrue(entry["grounded"])
        self.assertEqual(entry["sources"][0]["source"], "PAPER.md")

    def test_ungrounded_questions_are_logged_too(self):
        # These are the most valuable rows for the calibration study —
        # they're the retrieval misses.
        import rag.retriever
        marker = "ungrounded-marker-abc"
        with unittest.mock.patch.object(rag.retriever, "grounded_answer", return_value=_fake_found(grounded=False, top=1.2)):
            self.client.post("/api/ask", json={"question": marker})
        entry = next((e for e in db.get_rag_qa_log(limit=50) if e["question"] == marker), None)
        self.assertIsNotNone(entry)
        self.assertFalse(entry["grounded"])

    def test_log_export_is_admin_only(self):
        r = self.client.get("/api/admin/rag-qa-log")
        self.assertEqual(r.status_code, 403)


if __name__ == "__main__":
    unittest.main()
