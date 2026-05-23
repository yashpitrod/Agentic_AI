from __future__ import annotations

from agents.prompts import ARCHITECTURE_SYSTEM_PROMPT, build_architecture_prompt
from backend.gemini_client import call_gemini_json_array


async def run_architecture_agent(diff: str) -> list[dict]:
    try:
        return await call_gemini_json_array(
            prompt=build_architecture_prompt(diff),
            system=ARCHITECTURE_SYSTEM_PROMPT,
        )
    except Exception as exc:
        return [
            {
                "violation_type": "architecture_agent_error",
                "description": f"Architecture Agent could not complete Gemini review: {exc}",
                "refactor_suggestion": "Check GEMINI_API_KEY, GEMINI_MODEL, and Gemini API access.",
                "severity": "warning",
            }
        ]
