import io
from pathlib import Path


def extract_text(content: bytes, filename: str) -> str:
    """Extract text from a file based on its extension."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(content)
    elif ext == ".docx":
        return _extract_docx(content)
    elif ext in (".txt", ".md", ".csv", ".json"):
        return content.decode("utf-8", errors="replace")
    else:
        return content.decode("utf-8", errors="replace")


def _extract_pdf(content: bytes) -> str:
    import fitz  # pymupdf

    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts)


def _extract_docx(content: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(content))
    return "\n".join(paragraph.text for paragraph in doc.paragraphs)


def get_file_type(filename: str) -> str:
    ext = Path(filename).suffix.lower().lstrip(".")
    return ext if ext else "unknown"
