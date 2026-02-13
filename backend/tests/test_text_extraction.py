from app.utils.text_extraction import extract_text, get_file_type


def test_extract_plain_text():
    content = b"Hello, this is plain text."
    result = extract_text(content, "test.txt")
    assert result == "Hello, this is plain text."


def test_extract_markdown():
    content = b"# Title\n\nSome markdown content."
    result = extract_text(content, "test.md")
    assert "Title" in result


def test_extract_unknown_extension():
    content = b"Some content"
    result = extract_text(content, "file.xyz")
    assert result == "Some content"


def test_get_file_type_pdf():
    assert get_file_type("document.pdf") == "pdf"


def test_get_file_type_docx():
    assert get_file_type("report.docx") == "docx"


def test_get_file_type_txt():
    assert get_file_type("notes.txt") == "txt"


def test_get_file_type_no_extension():
    assert get_file_type("README") == "unknown"


def test_extract_utf8_with_special_chars():
    content = "Héllo wörld café".encode("utf-8")
    result = extract_text(content, "test.txt")
    assert "Héllo" in result
