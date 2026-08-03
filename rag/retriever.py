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
