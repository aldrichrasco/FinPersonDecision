"""
Loads the persisted Chroma index (built by rag/build_index.py) and answers
similarity-search queries against it. Kept separate from coach_agent.py so
it can be built, run, and tested as a standalone retrieval component,
independent of whether the LLM half of the pipeline has a working API key.
"""

import os

from rag.embeddings import FastEmbedEmbeddings

RAG_DIR = os.path.dirname(os.path.abspath(__file__))
PERSIST_DIR = os.path.join(RAG_DIR, "chroma_db")
COLLECTION_NAME = "finperson_research_notes"

_store = None  # lazy singleton: the embedding model loads once per process, not per query


class IndexNotBuilt(Exception):
    """Raised when rag/build_index.py hasn't been run yet."""


def _get_store():
    global _store
    if _store is not None:
        return _store
    if not os.path.isdir(PERSIST_DIR):
        raise IndexNotBuilt(
            f"No index at {PERSIST_DIR} — run `python rag/build_index.py` first."
        )
    from langchain_chroma import Chroma

    _store = Chroma(
        collection_name=COLLECTION_NAME,
        embedding_function=FastEmbedEmbeddings(),
        persist_directory=PERSIST_DIR,
    )
    return _store


def search(query: str, k: int = 3):
    """Returns up to k {"text", "source", "title", "score"} dicts, nearest
    first. `score` is a distance (lower = more similar) — Chroma's default
    space, not cosine similarity, so it's exposed for callers that want it
    but isn't a 0-1 relevance score."""
    store = _get_store()
    results = store.similarity_search_with_score(query, k=k)
    return [
        {
            "text": doc.page_content,
            "source": doc.metadata.get("source"),
            "title": doc.metadata.get("title"),
            "score": score,
        }
        for doc, score in results
    ]


# Empirically measured against this app's own index (fastembed
# BAAI/bge-small-en-v1.5 + Chroma's default L2 distance, lower = closer):
#
#   on-topic   0.43 - 0.56   "what is present bias" / "why compound interest matters"
#   off-topic  0.93 - 1.09   "how do I bake sourdough" / "capital of Mongolia"
#
# 0.75 sits in the empty band between those two clusters. It is a measured
# cutoff, not a guessed one — re-measure it if the embedding model or the
# corpus changes materially, because it is specific to both.
RELEVANCE_DISTANCE_MAX = 0.75


def grounded_answer(query: str, k: int = 3, max_distance: float = RELEVANCE_DISTANCE_MAX):
    """Retrieval-only response: the passages themselves plus their sources,
    or grounded=False when nothing clears the relevance bar.

    Deliberately returns no generated prose. Retrieval here is local
    (fastembed ONNX + on-disk Chroma) and therefore costs nothing per
    query, so this path can stay free and uncapped for anonymous visitors;
    the LLM-written coaching reply is the paid tier. It also means this
    works with no LLM provider key configured at all.

    grounded=False is the F3 "I don't have information on that" case — the
    caller must surface that honestly rather than falling back to the
    model's own knowledge, which is exactly where financial content gets
    confabulated.
    """
    results = search(query, k=k)
    relevant = [r for r in results if r["score"] <= max_distance]
    return {
        "grounded": bool(relevant),
        "results": relevant,
        "top_score": results[0]["score"] if results else None,
    }
