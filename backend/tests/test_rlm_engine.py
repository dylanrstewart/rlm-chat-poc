from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.rlm.engine import RLMEngine


def _make_response(content: str):
    choice = MagicMock()
    choice.message.content = content
    resp = MagicMock()
    resp.choices = [choice]
    return resp


@pytest.fixture
def engine():
    client = AsyncMock()
    return RLMEngine(client=client, model="test-model", sub_model="test-sub")


@pytest.mark.asyncio
async def test_single_iteration_with_submit(engine):
    """LLM writes code that calls SUBMIT → returns answer."""
    engine.client.chat.completions.create = AsyncMock(
        return_value=_make_response(
            '```python\nSUBMIT("The answer is 42")\n```'
        )
    )
    result = await engine.run(
        query="What is the answer?",
        context="",
        tools={},
        tool_prompt="",
    )
    assert result == "The answer is 42"


@pytest.mark.asyncio
async def test_multi_iteration(engine):
    """LLM does search → process → SUBMIT across multiple iterations."""
    responses = [
        _make_response('```python\nprint("searching...")\n```'),
        _make_response('```python\nSUBMIT("Found the answer")\n```'),
    ]
    engine.client.chat.completions.create = AsyncMock(side_effect=responses)

    result = await engine.run(
        query="Find something",
        context="",
        tools={},
        tool_prompt="",
    )
    assert result == "Found the answer"


@pytest.mark.asyncio
async def test_code_exception_captured(engine):
    """Code throws exception → error captured and fed back to LLM."""
    responses = [
        _make_response('```python\nraise ValueError("oops")\n```'),
        _make_response('```python\nSUBMIT("recovered")\n```'),
    ]
    engine.client.chat.completions.create = AsyncMock(side_effect=responses)

    result = await engine.run(
        query="Test error",
        context="",
        tools={},
        tool_prompt="",
    )
    assert result == "recovered"


@pytest.mark.asyncio
async def test_max_iterations(engine):
    """Max iterations reached → graceful return."""
    engine.max_iterations = 2
    responses = [
        _make_response('```python\nprint("step 1")\n```'),
        _make_response('```python\nprint("step 2")\n```'),
    ]
    engine.client.chat.completions.create = AsyncMock(side_effect=responses)

    result = await engine.run(
        query="Loop forever",
        context="",
        tools={},
        tool_prompt="",
    )
    assert "Max iterations" in result


@pytest.mark.asyncio
async def test_no_code_block_plain_text(engine):
    """No code block → plain text treated as answer."""
    engine.client.chat.completions.create = AsyncMock(
        return_value=_make_response("I know the answer directly: it's 42.")
    )
    result = await engine.run(
        query="Quick question",
        context="",
        tools={},
        tool_prompt="",
    )
    assert "42" in result


@pytest.mark.asyncio
async def test_on_repl_step_callback(engine):
    """on_repl_step callback fires correctly per iteration."""
    engine.client.chat.completions.create = AsyncMock(
        return_value=_make_response('```python\nSUBMIT("done")\n```')
    )

    steps = []
    async def on_step(step):
        steps.append(step)

    result = await engine.run(
        query="Test",
        context="",
        tools={},
        tool_prompt="",
        on_repl_step=on_step,
    )
    assert result == "done"
    assert len(steps) == 1
    assert steps[0]["iteration"] == 1
    assert steps[0]["has_answer"] is True


@pytest.mark.asyncio
async def test_inline_submit(engine):
    """SUBMIT in plain text (no code block) is parsed."""
    engine.client.chat.completions.create = AsyncMock(
        return_value=_make_response('The result is SUBMIT("inline answer")')
    )
    result = await engine.run(
        query="Test",
        context="",
        tools={},
        tool_prompt="",
    )
    assert result == "inline answer"


@pytest.mark.asyncio
async def test_tools_available_in_repl(engine):
    """Closure-scoped tools are accessible in REPL namespace."""
    engine.client.chat.completions.create = AsyncMock(
        return_value=_make_response(
            '```python\nresult = my_tool()\nSUBMIT(result)\n```'
        )
    )

    def my_tool():
        return "tool_output"

    result = await engine.run(
        query="Use tool",
        context="",
        tools={"my_tool": my_tool},
        tool_prompt="",
    )
    assert result == "tool_output"
