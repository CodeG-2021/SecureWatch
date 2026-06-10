"""
Document text extraction (HU-17).
Supports PDF (PyMuPDF primary, pdfplumber fallback) and DOCX.
"""

import io


def extract_pdf(data: bytes) -> tuple[str, int]:
    """Returns (text, page_count). Tries PyMuPDF first, pdfplumber as fallback."""
    try:
        import fitz  # PyMuPDF
        doc   = fitz.open(stream=data, filetype="pdf")
        pages = doc.page_count
        text  = "\n\n".join(page.get_text() for page in doc)
        doc.close()
        if text.strip():
            return text, pages
    except Exception:
        pass

    # Fallback: pdfplumber (better at complex layouts)
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = len(pdf.pages)
            text  = "\n\n".join(p.extract_text() or "" for p in pdf.pages)
            return text, pages
    except Exception as exc:
        raise RuntimeError(f"PDF extraction failed: {exc}") from exc


def extract_docx(data: bytes) -> tuple[str, int]:
    """Returns (text, paragraph_count)."""
    from docx import Document
    doc   = Document(io.BytesIO(data))
    paras = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paras), len(paras)


def extract(data: bytes, mime_type: str, filename: str) -> tuple[str, dict]:
    """
    Returns (text, metadata).
    metadata includes page/paragraph count, word count, etc.
    """
    mime = mime_type.lower()
    name = (filename or "").lower()

    if mime == "application/pdf" or name.endswith(".pdf"):
        text, pages = extract_pdf(data)
        return text, {"pages": pages, "word_count": len(text.split())}

    if (
        "wordprocessingml" in mime
        or mime == "application/msword"
        or name.endswith((".docx", ".doc"))
    ):
        text, paras = extract_docx(data)
        return text, {"paragraphs": paras, "word_count": len(text.split())}

    # Generic text fallback
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        text = data.decode("latin-1", errors="replace")
    return text, {"word_count": len(text.split())}
