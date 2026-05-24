from __future__ import annotations

import logging

from agents.prompts import ARCHITECTURE_SYSTEM_PROMPT, build_architecture_prompt
from backend.gemini_client import call_gemini_json_array

logger = logging.getLogger(__name__)


async def run_architecture_agent(diff: str) -> list[dict]:
    # Analyse the diff for design/maintainability violations via Gemini
    try:
        return await call_gemini_json_array(
            prompt=build_architecture_prompt(diff),
            system=ARCHITECTURE_SYSTEM_PROMPT,
        )
    except Exception as exc:
        logger.error("Architecture Agent Gemini call failed: %s", exc)
        return [
            {
                "violation_type": "architecture_agent_error",
                "description": f"Architecture Agent could not complete Gemini review: {exc}",
                "refactor_suggestion": "Check GEMINI_API_KEY, GEMINI_MODEL, and Gemini API access.",
                "severity": "warning",
            }
        ]
