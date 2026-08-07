"""
Builds the retrieval index search_research_notes (coach_agent.py's RAG tool)
searches: the app's own curated behavioral-finance content, embedded and
stored in a local Chroma collection.

Sources (three, all real, none fabricated for this exercise):
  1. idm.js's DECISION_MODELS   — the "beliefs being tested" citations
  2. learn.js's LEARN_CONTENT   — per-axis lessons + research citations
  3. PAPER.md                   — the design-science paper behind this app,
                                   chunked by section

(1) and (2) are pulled via rag/build_corpus.js into the CHECKED-IN snapshot
rag/corpus_js.json — see that file's docstring for why Node stays a dev-time
step rather than a hand-copied Python duplicate. This module deliberately
does NOT shell out to Node itself: Railway's Python-only build container has
no Node runtime, and this script runs as a build-time step there (see
nixpacks.toml) to bake the index into the deployed image rather than
building it — including a ~130MB model download — on a live request's cold
start. If idm.js/learn.js content changes, run `node rag/build_corpus.js`
and commit the updated corpus_js.json; this script will otherwise keep
embedding whatever snapshot is already on disk, silently, which is the
correct tradeoff for a deploy step (deterministic, no network call to
Node-land) but means a content edit with no re-run + recommit is a real way
for the index to go stale — there's no drift *detection* here, only a
drift-proof build once you remember the two-step workflow.

Run (from the repo root, as a module so the `rag.*` package imports resolve):
    node rag/build_corpus.js      # only when idm.js/learn.js content changes
    pip install -r requirements-agent.txt
    python -m rag.build_index

Rebuilds the index from scratch every run (cheap: ~50 short documents, a
few seconds) rather than trying to diff/update in place — simpler and
correct-by-construction, appropriate at this corpus size. Writes to
rag/chroma_db/, which is gitignored (a build artifact, not source) but IS
produced automatically during the Railway build (nixpacks.toml), so it's
part of the deployed image rather than missing until someone remembers to
build it.
"""

import json
import os
import re

from rag.embeddings import FastEmbedEmbeddings

RAG_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS_JS_PATH = os.path.join(RAG_DIR, "corpus_js.json")
PAPER_PATH = os.path.join(os.path.dirname(RAG_DIR), "PAPER.md")
PERSIST_DIR = os.path.join(RAG_DIR, "chroma_db")
COLLECTION_NAME = "finperson_research_notes"


# Static content pages whose .scenario-card sections are substantial prose
# already written and reviewed for this app — Good Financial Habits and the
# international retirement-systems comparison. Indexing them roughly doubles
# the corpus using material that is already verified, with none of the
# fabrication risk of writing new "literature summaries" from recall.
CONTENT_PAGES = [
    ("habits.html", "Good Financial Habits"),
    ("retirement.html", "Retirement Systems"),
]

_TAG_RE = re.compile(r"<[^>]+>")
_CARD_RE = re.compile(r'<section class="scenario-card">(.*?)</section>', re.S)
_EYEBROW_RE = re.compile(r'<p class="scenario-eyebrow"[^>]*>(.*?)</p>', re.S)
_H2_RE = re.compile(r"<h2[^>]*>(.*?)</h2>", re.S)
_P_RE = re.compile(r"<p(?![^>]*scenario-eyebrow)[^>]*>(.*?)</p>", re.S)


def _text(html_fragment):
    """Tags out, entities decoded, whitespace collapsed. Deliberately not a
    general HTML parser — these are this repo's own files with a known,
    stable card structure, and this runs at build time so a structural
    change shows up immediately as a document-count drop, not silently."""
    import html as html_mod

    return re.sub(r"\s+", " ", html_mod.unescape(_TAG_RE.sub(" ", html_fragment))).strip()


def _load_content_pages():
    docs = []
    for filename, label in CONTENT_PAGES:
        path = os.path.join(os.path.dirname(RAG_DIR), filename)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            markup = fh.read()
        for i, card in enumerate(_CARD_RE.findall(markup)):
            eyebrow = _EYEBROW_RE.search(card)
            heading = _H2_RE.search(card)
            title = _text(heading.group(1)) if heading else (_text(eyebrow.group(1)) if eyebrow else f"{label} {i}")
            body = " ".join(_text(p) for p in _P_RE.findall(card)).strip()
            if len(body) < 80:  # skip nav/CTA-only cards
                continue
            eyebrow_txt = _text(eyebrow.group(1)) if eyebrow else ""
            docs.append({
                "id": f"{filename}:{i}",
                "source": filename,
                "title": title,
                "text": f"{label} — {title}{f' ({eyebrow_txt})' if eyebrow_txt and eyebrow_txt != title else ''}: {body}",
            })
    return docs


def _load_js_documents():
    """Reads the committed corpus_js.json snapshot — see this module's
    docstring for why this doesn't regenerate it via Node at build time."""
    if not os.path.exists(CORPUS_JS_PATH):
        raise FileNotFoundError(
            f"{CORPUS_JS_PATH} not found — run `node rag/build_corpus.js` first "
            "and commit the result."
        )
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

    raw_docs = _load_js_documents() + _load_paper_sections() + _load_content_pages()
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
