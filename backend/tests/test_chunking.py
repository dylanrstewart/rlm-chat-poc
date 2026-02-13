from app.utils.chunking import chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   ") == []


def test_short_text_single_chunk():
    chunks = chunk_text("Hello world", chunk_size=100)
    assert len(chunks) == 1
    assert chunks[0].text == "Hello world"
    assert chunks[0].index == 0


def test_text_splits_into_multiple_chunks():
    text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph that is a bit longer."
    chunks = chunk_text(text, chunk_size=40, overlap=5)
    assert len(chunks) >= 2
    for chunk in chunks:
        assert len(chunk.text) > 0


def test_overlap_preserves_context():
    text = "A" * 500 + "\n\n" + "B" * 500
    chunks = chunk_text(text, chunk_size=600, overlap=50)
    assert len(chunks) >= 2


def test_chunk_indices_are_sequential():
    text = "\n\n".join([f"Paragraph {i} with some content to fill space." for i in range(20)])
    chunks = chunk_text(text, chunk_size=100, overlap=20)
    for i, chunk in enumerate(chunks):
        assert chunk.index == i


def test_very_long_word_hard_splits():
    text = "A" * 2000
    chunks = chunk_text(text, chunk_size=500, overlap=50)
    assert len(chunks) >= 2
    for chunk in chunks:
        assert len(chunk.text) <= 550  # allow some leeway


def test_chunks_have_start_end_chars():
    text = "Hello world. This is a test."
    chunks = chunk_text(text, chunk_size=1000)
    assert len(chunks) == 1
    assert chunks[0].start_char >= 0
    assert chunks[0].end_char > chunks[0].start_char
