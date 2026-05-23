from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-2.0-flash"
MAX_RETRIES = 1


def _extract_text(response_json: dict[str, Any]) -> str:
    candidates = response_json.get("candidates", [])
    if not candidates:
        return ""

    parts = candidates[0].get("content", {}).get("parts", [])
    return "".join(part.get("text", "") for part in parts)


def parse_json_array(raw_text: str) -> list[dict]:
    cleaned = raw_text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned.removeprefix("```json").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```").strip()
    if cleaned.endswith("```"):
        cleaned = cleaned.removesuffix("```").strip()

    parsed = json.loads(cleaned or "[]")
    if not isinstance(parsed, list):
        raise ValueError("Gemini response was not a JSON array.")
    return parsed


async def call_gemini_json_array(prompt: str, system: str, max_tokens: int = 2000) -> list[dict]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")

    model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
    url = GEMINI_API_URL.format(model=model)
    payload = {
        "system_instruction": {
            "parts": [{"text": system}],
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=60) as client:
        for attempt in range(MAX_RETRIES + 1):
            response = await client.post(url, params={"key": api_key}, json=payload)

            if response.status_code == 429 and attempt < MAX_RETRIES:
                await asyncio.sleep(2)
                continue

            if response.status_code == 429:
                raise RuntimeError(
                    "Gemini API rate limit or quota exceeded (HTTP 429). "
                    "Wait a bit, reduce calls, or check your Gemini quota/billing."
                )

            if response.is_error:
                raise RuntimeError(
                    f"Gemini API request failed with HTTP {response.status_code}: {response.text[:300]}"
                )

            break

    return parse_json_array(_extract_text(response.json()))
