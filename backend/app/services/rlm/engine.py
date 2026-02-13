import contextlib
import io
import re
from typing import Any, Callable

from openai import AsyncOpenAI

from app.services.rlm.prompts import build_system_prompt


class RLMEngine:
    def __init__(
        self,
        client: AsyncOpenAI,
        model: str,
        sub_model: str,
        max_iterations: int = 15,
    ):
        self.client = client
        self.model = model
        self.sub_model = sub_model
        self.max_iterations = max_iterations

    async def run(
        self,
        query: str,
        context: str,
        tools: dict,
        tool_prompt: str,
        on_repl_step: Callable | None = None,
    ) -> str:
        repl_globals: dict[str, Any] = {"__builtins__": __builtins__}
        final_answer: dict[str, str | None] = {"value": None}

        def submit(answer):
            final_answer["value"] = str(answer)

        def llm_query(prompt: str, ctx: str = "") -> str:
            """Sub-LM call available inside the REPL."""
            import asyncio

            async def _call():
                content = f"{prompt}\n\nContext:\n{ctx}" if ctx else prompt
                messages = [{"role": "user", "content": content}]
                response = await self.client.chat.completions.create(
                    model=self.sub_model,
                    messages=messages,
                    max_tokens=2000,
                )
                return response.choices[0].message.content

            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                new_loop = asyncio.new_event_loop()
                try:
                    return new_loop.run_until_complete(_call())
                finally:
                    new_loop.close()
            else:
                return asyncio.run(_call())

        # Inject into namespace
        repl_globals["context"] = context
        repl_globals["llm_query"] = llm_query
        repl_globals["SUBMIT"] = submit
        repl_globals.update(tools)

        system_prompt = build_system_prompt(context, tool_prompt)

        history = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Query: {query}"},
        ]

        for iteration in range(self.max_iterations):
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=history,
                max_tokens=4000,
            )
            assistant_msg = response.choices[0].message.content
            history.append({"role": "assistant", "content": assistant_msg})

            code = self._extract_code(assistant_msg)

            if code:
                stdout_capture = io.StringIO()
                stderr_capture = io.StringIO()

                try:
                    with contextlib.redirect_stdout(stdout_capture), \
                         contextlib.redirect_stderr(stderr_capture):
                        exec(code, repl_globals, repl_globals)
                except Exception as e:
                    stderr_capture.write(f"Error: {type(e).__name__}: {str(e)}")

                stdout = stdout_capture.getvalue()[:8192]
                stderr = stderr_capture.getvalue()[:2000]

                repl_output = ""
                if stdout:
                    repl_output += f"stdout:\n{stdout}\n"
                if stderr:
                    repl_output += f"stderr:\n{stderr}\n"
                if not repl_output:
                    repl_output = "(no output)"

                if on_repl_step:
                    await on_repl_step({
                        "iteration": iteration + 1,
                        "code": code,
                        "output": repl_output,
                        "has_answer": final_answer["value"] is not None,
                    })

                history.append({
                    "role": "user",
                    "content": f"REPL output:\n{repl_output}",
                })

                if final_answer["value"] is not None:
                    return final_answer["value"]
            else:
                # No code block — check for inline SUBMIT
                if "SUBMIT" in assistant_msg:
                    match = re.search(r'SUBMIT\(["\']?(.*?)["\']?\)', assistant_msg, re.DOTALL)
                    if match:
                        return match.group(1)

                # Treat as final answer
                return assistant_msg

        return "Max iterations reached without a final answer."

    def _extract_code(self, response: str) -> str | None:
        """Extract Python code from markdown code blocks."""
        match = re.search(r'```(?:python|repl)\n(.*?)```', response, re.DOTALL)
        return match.group(1).strip() if match else None
