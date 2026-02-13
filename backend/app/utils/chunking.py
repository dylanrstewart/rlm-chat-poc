from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    text: str
    index: int
    start_char: int
    end_char: int


def chunk_text(
    text: str,
    chunk_size: int = 800,
    overlap: int = 100,
    separators: tuple[str, ...] = ("\n\n", "\n", ". ", " "),
) -> list[TextChunk]:
    """Recursively split text into chunks of approximately chunk_size characters."""
    if not text or not text.strip():
        return []

    chunks: list[str] = []
    _recursive_split(text, chunk_size, overlap, list(separators), chunks)

    result = []
    offset = 0
    for i, chunk in enumerate(chunks):
        start = text.find(chunk[:50], offset)
        if start == -1:
            start = offset
        result.append(TextChunk(text=chunk, index=i, start_char=start, end_char=start + len(chunk)))
        offset = max(offset, start + len(chunk) - overlap)

    return result


def _recursive_split(
    text: str,
    chunk_size: int,
    overlap: int,
    separators: list[str],
    output: list[str],
) -> None:
    if len(text) <= chunk_size:
        stripped = text.strip()
        if stripped:
            output.append(stripped)
        return

    if not separators:
        # No separators left: hard split
        for i in range(0, len(text), chunk_size - overlap):
            piece = text[i : i + chunk_size].strip()
            if piece:
                output.append(piece)
        return

    sep = separators[0]
    parts = text.split(sep)

    current = ""
    for part in parts:
        candidate = (current + sep + part).strip() if current else part.strip()
        if len(candidate) > chunk_size and current:
            output.append(current.strip())
            # Keep overlap from the end of current
            overlap_text = current[-overlap:] if overlap else ""
            current = (overlap_text + sep + part).strip() if overlap_text else part.strip()
        else:
            current = candidate

    if current.strip():
        if len(current) > chunk_size:
            _recursive_split(current, chunk_size, overlap, separators[1:], output)
        else:
            output.append(current.strip())
