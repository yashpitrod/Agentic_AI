from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import random
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-2.5-flash"
FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
MAX_RETRIES = 3
CACHE_FILE = ".gemini_cache.json"

# In-memory cache loaded from and persisted to CACHE_FILE
_cache: dict[str, list[dict]] = {}
_cache_lock = asyncio.Lock()


def _load_cache() -> None:
    global _cache
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                _cache = json.load(f)
            logger.debug("Loaded %d entries from persistent cache.", len(_cache))
        except Exception as e:
            logger.warning("Failed to load cache from file: %s", e)


def _save_cache() -> None:
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning("Failed to save cache to file: %s", e)


# Initialise cache synchronously on import
_load_cache()


def _extract_text(response_json: dict[str, Any]) -> str:
    candidates = response_json.get("candidates", [])
    if not candidates:
        return ""
    parts = candidates[0].get("content", {}).get("parts", [])
    return "".join(part.get("text", "") for part in parts)


def parse_json_array(raw_text: str) -> list[dict]:
    # Strip markdown code fences if Gemini wraps the response
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


def _get_cache_key(model: str, system: str, prompt: str) -> str:
    hasher = hashlib.sha256()
    hasher.update(f"{model}|||{system}|||{prompt}".encode("utf-8"))
    return hasher.hexdigest()


async def call_gemini_json_array(prompt: str, system: str, max_tokens: int = 2000) -> list[dict]:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")

    base_model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)

    # Check cache first
    cache_key = _get_cache_key(base_model, system, prompt)
    async with _cache_lock:
        if cache_key in _cache:
            logger.debug("Cache hit for model %s", base_model)
            return _cache[cache_key]

    # Prepare candidate models starting with the requested one, then fallbacks
    models_to_try = [base_model]
    for fallback in FALLBACK_MODELS:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_exception = None
    response_data = None

    async with httpx.AsyncClient(timeout=60) as client:
        for model in models_to_try:
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

            logger.info("Attempting review with model: %s", model)

            for attempt in range(MAX_RETRIES + 1):
                try:
                    response = await client.post(url, params={"key": api_key}, json=payload)

                    # Handle model unavailability or permission restrictions
                    if response.status_code in (403, 404):
                        logger.warning("Model %s not available (HTTP %d). Trying next fallback.", model, response.status_code)
                        break

                    # Handle rate limits and quota exceeded
                    if response.status_code == 429:
                        try:
                            error_msg = response.json().get("error", {}).get("message", "")
                        except Exception:
                            error_msg = ""
                        is_quota = "quota" in error_msg.lower() or "exceeded" in error_msg.lower()

                        if is_quota:
                            logger.warning("Model %s exceeded quota. Trying next fallback.", model)
                            break

                        if attempt < MAX_RETRIES:
                            sleep_time = (2 ** attempt) + random.uniform(0.1, 1.0)
                            logger.warning("HTTP 429 rate limit. Retrying in %.2fs...", sleep_time)
                            await asyncio.sleep(sleep_time)
                            continue
                        else:
                            raise RuntimeError(
                                f"Gemini API rate limit exceeded (HTTP 429) for model {model} after {MAX_RETRIES} retries."
                            )

                    if response.is_error:
                        raise RuntimeError(
                            f"Gemini API request failed with HTTP {response.status_code}: {response.text[:300]}"
                        )

                    # Successful call
                    response_data = response.json()
                    break

                except Exception as e:
                    last_exception = e
                    if attempt < MAX_RETRIES:
                        sleep_time = (1.5 ** attempt) + random.uniform(0.1, 0.5)
                        logger.warning("Transient error: %s. Retrying in %.2fs...", e, sleep_time)
                        await asyncio.sleep(sleep_time)
                    else:
                        logger.error("Failed all retries for model %s: %s", model, e)

            if response_data is not None:
                break

    if response_data is None:
        raise last_exception or RuntimeError("All Gemini models failed to generate content.")

    try:
        parsed_result = parse_json_array(_extract_text(response_data))
    except Exception as e:
        logger.error("Failed to parse JSON response: %s", e)
        raise e

    # Update cache and persist
    async with _cache_lock:
        _cache[cache_key] = parsed_result
        _save_cache()

    return parsed_result


async def call_gemini_text(prompt: str, system: str = "", max_tokens: int = 500) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")

    base_model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
    models_to_try = [base_model]
    for fallback in FALLBACK_MODELS:
        if fallback not in models_to_try:
            models_to_try.append(fallback)

    last_exception = None

    async with httpx.AsyncClient(timeout=60) as client:
        for model in models_to_try:
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
                    "temperature": 0.2,
                },
            }

            for attempt in range(MAX_RETRIES + 1):
                try:
                    response = await client.post(url, params={"key": api_key}, json=payload)

                    if response.status_code in (403, 404):
                        break

                    if response.status_code == 429:
                        if attempt < MAX_RETRIES:
                            sleep_time = (2 ** attempt) + random.uniform(0.1, 1.0)
                            await asyncio.sleep(sleep_time)
                            continue
                        break

                    if response.is_error:
                        raise RuntimeError(
                            f"Gemini API request failed with HTTP {response.status_code}: {response.text[:300]}"
                        )

                    return _extract_text(response.json()).strip()

                except Exception as exc:
                    last_exception = exc
                    if attempt < MAX_RETRIES:
                        sleep_time = (1.5 ** attempt) + random.uniform(0.1, 0.5)
                        await asyncio.sleep(sleep_time)
                    else:
                        break

    raise last_exception or RuntimeError("All Gemini models failed to generate text.")
