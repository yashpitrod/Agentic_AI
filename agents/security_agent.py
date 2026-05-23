from __future__ import annotations

from agents.prompts import SECURITY_SYSTEM_PROMPT, build_security_prompt
from backend.gemini_client import call_gemini_json_array


async def run_security_agent(diff: str) -> list[dict]:
    try:
        return await call_gemini_json_array(
            prompt=build_security_prompt(diff),
            system=SECURITY_SYSTEM_PROMPT,
        )
    except Exception as exc:
        return [
            {
                "issue_type": "security_agent_error",
                "severity": "warning",
                "file": "",
                "description": f"Security Agent could not complete Gemini review: {exc}",
                "line_hint": "",
            }
        ]
