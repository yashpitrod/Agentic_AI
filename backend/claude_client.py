from __future__ import annotations

from backend.gemini_client import call_gemini_json_array


async def call_claude_async(prompt: str, system: str = "", max_tokens: int = 2000) -> str:
    """Backward-compatible wrapper. This project now uses Gemini, not Claude."""
    result = await call_gemini_json_array(prompt=prompt, system=system, max_tokens=max_tokens)
    return str(result)
