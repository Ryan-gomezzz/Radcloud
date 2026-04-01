"""In-memory FAISS vector store for RAG knowledge base.

Built at startup from markdown files in rag/knowledge/.
Falls back gracefully if FAISS or Bedrock are unavailable.
"""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np

from rag.chunker import Chunk, chunk_document
from rag.embeddings import embedding_dimension, get_embedding

logger = logging.getLogger(__name__)

_KNOWLEDGE_DIR = Path(__file__).parent / "knowledge"


class RAGStore:
    def __init__(self) -> None:
        self._index = None  # faiss.IndexFlatIP
        self._chunks: list[Chunk] = []
        self._built = False
        self._dim = embedding_dimension()

    def is_ready(self) -> bool:
        return self._built and self._index is not None

    async def build(self) -> None:
        """Load knowledge files, chunk, embed, and build FAISS index."""
        try:
            import faiss
        except ImportError:
            logger.warning("faiss-cpu not installed — RAG disabled")
            return

        md_files = list(_KNOWLEDGE_DIR.glob("*.md"))
        if not md_files:
            logger.warning("No knowledge files found in %s", _KNOWLEDGE_DIR)
            return

        all_chunks: list[Chunk] = []
        for md_file in md_files:
            text = md_file.read_text(encoding="utf-8")
            chunks = chunk_document(text, source_file=md_file.name)
            all_chunks.extend(chunks)
            logger.info("Chunked %s: %d chunks", md_file.name, len(chunks))

        logger.info("Total chunks: %d. Generating embeddings...", len(all_chunks))

        vectors: list[list[float]] = []
        valid_chunks: list[Chunk] = []
        for chunk in all_chunks:
            vec = get_embedding(chunk.text)
            if vec is not None:
                vectors.append(vec)
                valid_chunks.append(chunk)

        if not vectors:
            logger.warning("No embeddings generated — RAG disabled (Bedrock may be unreachable)")
            return

        matrix = np.array(vectors, dtype=np.float32)
        index = faiss.IndexFlatIP(self._dim)
        faiss.normalize_L2(matrix)
        index.add(matrix)

        self._index = index
        self._chunks = valid_chunks
        self._built = True
        logger.info("RAG index built: %d vectors (%d chunks embedded)", index.ntotal, len(valid_chunks))

    def retrieve(self, query: str, top_k: int = 5) -> str:
        """Return top-k relevant chunks as a formatted context string."""
        if not self.is_ready():
            return ""

        import faiss

        query_vec = get_embedding(query)
        if query_vec is None:
            return ""

        q = np.array([query_vec], dtype=np.float32)
        faiss.normalize_L2(q)

        distances, indices = self._index.search(q, min(top_k, len(self._chunks)))

        parts: list[str] = []
        for idx in indices[0]:
            if 0 <= idx < len(self._chunks):
                chunk = self._chunks[idx]
                parts.append(f"[Source: {chunk.source_file} / {chunk.section_heading}]\n{chunk.text}")

        if not parts:
            return ""

        return "\n\n---\n\n".join(parts)


# Singleton instance
_store = RAGStore()


async def build_store() -> None:
    await _store.build()


def get_store() -> RAGStore:
    return _store
