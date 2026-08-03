"""
Tests for the RAG retrieval pipeline (rag/) and its use as coach_agent.py's
search_research_notes tool.

CI (.github/workflows/ci.yml) only installs requirements.txt and only sets
up Python, not Node — fastembed/chromadb/langchain-chroma AND the `node`
binary (needed by rag/build_corpus.js) are both optional here. Every test
either exercises pure-Python logic that needs neither, or is explicitly
skipped when its dependency is missing.
"""

import importlib.util
import shutil
import tempfile
import unittest
import unittest.mock

import coach_agent

_HAS_RAG_DEPS = all(
    importlib.util.find_spec(pkg) is not None
    for pkg in ("fastembed", "chromadb", "langchain_chroma")
)
_HAS_NODE = shutil.which("node") is not None


class SearchToolDegradesGracefullyTests(unittest.TestCase):
    """These must hold regardless of whether requirements-agent.txt or Node
    are installed -- this is the boundary that keeps a missing optional
    dependency from ever crashing the agent."""

    def setUp(self):
        if not _HAS_RAG_DEPS:
            self.skipTest("fastembed/chromadb/langchain-chroma not installed")
        from langchain_core.tools import tool

        self.tools = {t.name: t for t in coach_agent._build_tools(None, tool)}

    def test_reports_when_index_not_built(self):
        import rag.retriever as retriever

        with unittest.mock.patch.object(retriever, "PERSIST_DIR", tempfile.mkdtemp() + "-missing"):
            with unittest.mock.patch.object(retriever, "_store", None):
                result = self.tools["search_research_notes"].invoke({"query": "anything"})
        self.assertIn("build_index", result)

    def test_tool_is_registered_alongside_the_others(self):
        self.assertIn("search_research_notes", self.tools)
        self.assertIn("get_my_profile", self.tools)


@unittest.skipUnless(_HAS_RAG_DEPS, "fastembed/chromadb/langchain-chroma not installed")
class EmbeddingsTests(unittest.TestCase):
    """Exercises the hand-written Embeddings adapter directly -- the part
    that's actually mine, as opposed to langchain-chroma's own (separately
    maintained, separately trusted) storage logic."""

    @classmethod
    def setUpClass(cls):
        from rag.embeddings import FastEmbedEmbeddings

        cls.embeddings = FastEmbedEmbeddings()

    def test_embed_query_returns_a_vector(self):
        vec = self.embeddings.embed_query("saving money for the future")
        self.assertIsInstance(vec, list)
        self.assertGreater(len(vec), 0)
        self.assertTrue(all(isinstance(x, float) for x in vec))

    def test_embed_documents_returns_one_vector_per_text(self):
        vecs = self.embeddings.embed_documents(["first passage", "second passage"])
        self.assertEqual(len(vecs), 2)
        self.assertEqual(len(vecs[0]), len(vecs[1]))

    def test_similar_texts_are_closer_than_dissimilar_ones(self):
        # A cheap sanity check that this is actually a semantic embedding
        # and not, say, a hash -- "saving" and "budgeting" should sit closer
        # together than "saving" and an unrelated sentence about weather.
        import math

        def cosine(a, b):
            dot = sum(x * y for x, y in zip(a, b))
            na = math.sqrt(sum(x * x for x in a))
            nb = math.sqrt(sum(y * y for y in b))
            return dot / (na * nb)

        v_saving = self.embeddings.embed_query("I want to save more money each month")
        v_budget = self.embeddings.embed_query("How do I stick to a monthly budget")
        v_weather = self.embeddings.embed_query("It might rain tomorrow afternoon")
        self.assertGreater(cosine(v_saving, v_budget), cosine(v_saving, v_weather))


@unittest.skipUnless(_HAS_NODE, "node not available in this environment")
class CorpusBuilderTests(unittest.TestCase):
    """Runs the real rag/build_corpus.js against the real idm.js/learn.js --
    this is what proves the content pulled into the index is what those
    files actually contain right now, not a stale/hand-copied guess."""

    def test_builds_documents_from_idm_and_learn(self):
        import json
        import os
        import subprocess

        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        subprocess.run(["node", os.path.join(repo_root, "rag", "build_corpus.js")], check=True, cwd=repo_root)
        with open(os.path.join(repo_root, "rag", "corpus_js.json"), encoding="utf-8") as f:
            docs = json.load(f)

        self.assertGreater(len(docs), 10)
        sources = {d["source"] for d in docs}
        self.assertEqual(sources, {"idm.js", "learn.js"})
        for doc in docs:
            self.assertTrue(doc["text"])
            self.assertTrue(doc["title"])


if __name__ == "__main__":
    unittest.main()
