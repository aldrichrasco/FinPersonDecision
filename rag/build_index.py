"""
Builds the retrieval index search_research_notes (coach_agent.py's RAG tool)
searches: the app's own curated behavioral-finance content, embedded and
stored in a local Chroma collection.

Sources (three, all real, none fabricated for this exercise):
  1. idm.js's DECISION_MODELS   — the "beliefs being tested" citations
  2. learn.js's LEARN_CONTENT   — per-axis lessons + research citations
  3. PAPER.md                   — the design-science paper behind this app,
                                   chunked by section

(1) and (2) are pulled via rag/build_corpus.js — see that file's docstring
for why this goes through Node rather than a hand-copied Python duplicate.

Run (from the repo root, as a module so the `rag.*` package imports resolve):
    pip install -r requirements-agent.txt
    python -m rag.build_index

Rebuilds the index from scratch every run (cheap: ~50 short documents, a
few seconds) rather than trying to diff/update in place — simpler and
correct-by-construction, appropriate at this corpus size. Writes to
rag/chroma_db/, which is gitignored (a build artifact, not source).
"""

import json
import os
import re
import subprocess

from rag.embeddings import FastEmbedEmbeddings

RAG_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS_JS_PATH = os.path.join(RAG_DIR, "corpus_js.json")
PAPER_PATH = os.path.join(os.path.dirname(RAG_DIR), "PAPER.md")
PERSIST_DIR = os.path.join(RAG_DIR, "chroma_db")
COLLECTION_NAME = "finperson_research_notes"


def _load_js_documents():
    """Regenerates corpus_js.json fresh every build (via Node) rather than
    trusting a possibly-stale copy on disk — this is what guarantees the
    index can never silently drift from idm.js/learn.js's actual content."""
    subprocess.run(["node", os.path.join(RAG_DIR, "build_corpus.js")], check=True)
    with open(CORPUS_JS_PATH, encoding="utf-8") as f:
        return json.load(f)


def _load_paper_sections():
    """Chunks PAPER.md by ## section headers. The references section is
    excluded deliberately: it's a bare citation list with no explanatory
    text, which would just add noise to retrieval without ever being a
    useful passage to ground a coaching answer in."""
    if not os.path.exists(PAPER_PATH):
        return []
    with open(PAPER_PATH, encoding="utf-8") as f:
        text = f.read()

    sections = re.split(r"\n(?=## )", text)
    docs = []
    for section in sections:
        header_match = re.match(r"## (.+)", section)
        if not header_match:
            continue
        title = header_match.group(1).strip()
        if title.lower().startswith("references"):
            continue
        body = section[header_match.end():].strip()
        if len(body) < 80:  # skip near-empty stub sections
            continue
        docs.append({
            "id": f"paper:{title}",
            "source": "PAPER.md",
            "title": title,
            "text": f"{title}. {body}",
        })
    return docs


def _chunk(docs, max_chars=1200, overlap=150):
    """Splits any document longer than max_chars into overlapping windows —
    PAPER.md's sections run to several paragraphs, far longer than the
    idm.js/learn.js entries, and a whole section as one embedding vector
    dilutes the specific passage that would actually answer a query."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter

    splitter = RecursiveCharacterTextSplitter(chunk_size=max_chars, chunk_overlap=overlap)
    out = []
    for doc in docs:
        pieces = splitter.split_text(doc["text"])
        for i, piece in enumerate(pieces):
            suffix = f":chunk{i}" if len(pieces) > 1 else ""
            out.append({**doc, "id": doc["id"] + suffix, "text": piece})
    return out


def build():
    import shutil

    from langchain_chroma import Chroma
    from langchain_core.documents import Document

    # Delete any prior index first — from_documents() would otherwise upsert
    # into whatever's already on disk, which risks stale chunks lingering
    # after a source document is edited or removed. A from-scratch rebuild
    # is cheap enough at this corpus size that there's no reason to diff.
    if os.path.isdir(PERSIST_DIR):
        shutil.rmtree(PERSIST_DIR)

    raw_docs = _load_js_documents() + _load_paper_sections()
    chunked = _chunk(raw_docs)
    print(f"{len(raw_docs)} source documents -> {len(chunked)} chunks after splitting.")

    documents = [
        Document(page_content=d["text"], metadata={"source": d["source"], "title": d["title"]}, id=d["id"])
        for d in chunked
    ]

    print("Loading local embedding model (first run downloads ~130MB from Hugging Face)...")
    embeddings = FastEmbedEmbeddings()

    print(f"Embedding {len(documents)} chunks and writing to {PERSIST_DIR} ...")
    Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        collection_name=COLLECTION_NAME,
        persist_directory=PERSIST_DIR,
    )
    print("Done.")


if __name__ == "__main__":
    build()
