"""
A LangChain Embeddings adapter over fastembed — a local, ONNX-runtime model
(no torch, no API key, ~130MB one-time download from Hugging Face). Written
by hand against LangChain's Embeddings interface rather than pulled from
langchain-community's FastEmbedEmbeddings, which is deprecated and slated
for removal (community integrations are being split into standalone
packages; no standalone langchain-fastembed exists as of this writing).

Local embeddings were the deliberate choice here, not just the convenient
one: Anthropic has no first-party embeddings endpoint, so a RAG pipeline
built on this app's existing ANTHROPIC_API_KEY would need a second provider
key (OpenAI, Voyage AI) regardless — and the app's own key is, at the time
this was built, tied to a disabled organisation. A local model means the
retrieval half of RAG (build the index, embed a query, get relevant chunks
back) is fully verifiable without any working API key; only the final
"coach answers using retrieved context" step needs one.
"""

try:
    from langchain_core.embeddings import Embeddings
except ModuleNotFoundError:  # pragma: no cover - exercised when optional agent deps are absent
    class Embeddings:  # type: ignore[no-redef]
        """Fallback base class when langchain-core is not installed."""

        pass


class FastEmbedEmbeddings(Embeddings):
    """model_name defaults to a small (~130MB), quantized, English sentence
    model — fine for this corpus's size (a few hundred short passages)."""

    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        from fastembed import TextEmbedding

        self._model = TextEmbedding(model_name=model_name)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        # BGE is an asymmetric model: passages and queries get different
        # instruction prefixes internally, so passage_embed (not the plain
        # embed() alias) is the correct call for indexing document text —
        # using the wrong one silently degrades retrieval quality rather
        # than erroring, which is what makes this easy to get wrong.
        return [v.tolist() for v in self._model.passage_embed(texts)]

    def embed_query(self, text: str) -> list[float]:
        return next(self._model.query_embed(text)).tolist()
