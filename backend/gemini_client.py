from __future__ import annotations

import asyncio
import json
import os
import hashlib
import random
from typing import Any

import httpx
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = "gemini-2.5-flash"
FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-2.0-flash-lite"]
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
            print(f"[Gemini Client] Loaded {len(_cache)} entries from persistent cache.")
        except Exception as e:
            print(f"[Gemini Client] Warning: Failed to load cache from file: {e}")


def _save_cache() -> None:
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(_cache, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[Gemini Client] Warning: Failed to save cache to file: {e}")


# Initialize cache synchronously on import
_load_cache()


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
            print(f"[Gemini Client] Cache hit for model {base_model}")
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

            print(f"[Gemini Client] Attempting review with model: {model}...")

            for attempt in range(MAX_RETRIES + 1):
                try:
                    response = await client.post(url, params={"key": api_key}, json=payload)
                    
                    # 1. Handle model unavailability or permission restrictions (HTTP 404 / 403)
                    if response.status_code in (403, 404):
                        print(f"[Gemini Client] Model {model} is not available/authorized (HTTP {response.status_code}). Trying next fallback...")
                        break

                    # 2. Handle rate limits and quota exceeded (HTTP 429)
                    if response.status_code == 429:
                        try:
                            error_msg = response.json().get("error", {}).get("message", "")
                        except Exception:
                            error_msg = ""
                        is_quota = "quota" in error_msg.lower() or "exceeded" in error_msg.lower()
                        
                        if is_quota:
                            print(f"[Gemini Client] Model {model} exceeded quota/limit. Trying next fallback...")
                            # No use retrying this specific model if it's out of quota
                            break
                        
                        if attempt < MAX_RETRIES:
                            # Exponential backoff with jitter
                            sleep_time = (2 ** attempt) + random.uniform(0.1, 1.0)
                            print(f"[Gemini Client] HTTP 429 Rate Limit. Retrying in {sleep_time:.2f}s...")
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

                    # Successful call!
                    response_data = response.json()
                    break

                except Exception as e:
                    last_exception = e
                    if attempt < MAX_RETRIES:
                        sleep_time = (1.5 ** attempt) + random.uniform(0.1, 0.5)
                        print(f"[Gemini Client] Transient error: {e}. Retrying in {sleep_time:.2f}s...")
                        await asyncio.sleep(sleep_time)
                    else:
                        print(f"[Gemini Client] Failed all retries for model {model}: {e}")

            if response_data is not None:
                # Successfully received response, stop checking fallback models
                break

    if response_data is None:
        # All models failed
        raise last_exception or RuntimeError("All Gemini models failed to generate content.")

    try:
        parsed_result = parse_json_array(_extract_text(response_data))
    except Exception as e:
        print(f"[Gemini Client] Failed to parse JSON response: {e}")
        raise e

    # Update cache and save
    async with _cache_lock:
        _cache[cache_key] = parsed_result
        _save_cache()

    return parsed_result
