from __future__ import annotations

import logging

from agents.prompts import SECURITY_SYSTEM_PROMPT, build_security_prompt
from backend.gemini_client import call_gemini_json_array

logger = logging.getLogger(__name__)


async def run_security_agent(diff: str) -> list[dict]:
    # Analyse the diff for OWASP-style security vulnerabilities via Gemini
    try:
        return await call_gemini_json_array(
            prompt=build_security_prompt(diff),
            system=SECURITY_SYSTEM_PROMPT,
        )
    except Exception as exc:
        logger.error("Security Agent Gemini call failed: %s", exc)
        return [
            {
                "issue_type": "security_agent_error",
                "severity": "warning",
                "file": "",
                "description": f"Security Agent could not complete Gemini review: {exc}",
                "line_hint": "",
            }
        ]
