"""Text chunking utilities for RAG knowledge base."""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass
class Chunk:
    text: str
    source_file: str
    section_heading: str
    chunk_index: int
    token_count: int


def _simple_token_count(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(text) // 4)


def chunk_document(text: str, source_file: str, chunk_size: int = 512, overlap: int = 64) -> list[Chunk]:
    """Split a markdown document into overlapping chunks, preserving section headers."""
    chunks: list[Chunk] = []

    # Split into paragraphs/sections
    sections = _split_by_headers(text)

    chunk_index = 0
    for heading, section_text in sections:
        # Tokenize roughly into words
        words = section_text.split()
        if not words:
            continue

        # Approximate chars per token
        chars_per_token = 4
        max_chars = chunk_size * chars_per_token
        overlap_chars = overlap * chars_per_token

        # Slide window over section text
        start = 0
        section_full = f"{heading}\n\n{section_text}" if heading else section_text

        while start < len(section_full):
            end = min(start + max_chars, len(section_full))
            chunk_text = section_full[start:end].strip()

            if chunk_text:
                # Always prefix with heading for context
                if heading and not chunk_text.startswith(heading):
                    prefix = f"[Section: {heading}] "
                    chunk_text = prefix + chunk_text

                chunks.append(Chunk(
                    text=chunk_text,
                    source_file=source_file,
                    section_heading=heading or "(top level)",
                    chunk_index=chunk_index,
                    token_count=_simple_token_count(chunk_text),
                ))
                chunk_index += 1

            if end == len(section_full):
                break
            start = end - overlap_chars

    return chunks


def _split_by_headers(text: str) -> list[tuple[str, str]]:
    """Return list of (heading, content) pairs."""
    header_pattern = re.compile(r'^(#{1,3})\s+(.+)$', re.MULTILINE)
    sections: list[tuple[str, str]] = []

    matches = list(header_pattern.finditer(text))
    if not matches:
        return [("", text)]

    # Text before first header
    if matches[0].start() > 0:
        sections.append(("", text[:matches[0].start()].strip()))

    for i, match in enumerate(matches):
        heading = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        content = text[start:end].strip()
        if content:
            sections.append((heading, content))

    return sections
