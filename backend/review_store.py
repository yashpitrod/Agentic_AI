from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from uuid import uuid4

import aiosqlite

logger = logging.getLogger(__name__)

# Path to the SQLite database file
_db_path: str = os.getenv("REVIEWS_DB_PATH", "reviews.db")


async def init_db() -> None:
    # Create the reviews table if it does not exist yet
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "CREATE TABLE IF NOT EXISTS reviews ("
            "  id TEXT PRIMARY KEY,"
            "  created_at TEXT NOT NULL,"
            "  payload TEXT NOT NULL"
            ")"
        )
        await db.commit()
    logger.info("SQLite database initialised at %s", _db_path)


async def save_review(review: dict) -> dict:
    # Persist a review dict into SQLite and return the enriched record
    review_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    stored = {"id": review_id, "created_at": created_at, **review}
    async with aiosqlite.connect(_db_path) as db:
        await db.execute(
            "INSERT INTO reviews (id, created_at, payload) VALUES (?, ?, ?)",
            (review_id, created_at, json.dumps(stored, default=str)),
        )
        await db.commit()
    logger.info("Review %s saved to database", review_id)
    return stored


async def list_reviews() -> list[dict]:
    # Retrieve all reviews ordered by most recent first
    async with aiosqlite.connect(_db_path) as db:
        cursor = await db.execute(
            "SELECT payload FROM reviews ORDER BY created_at DESC"
        )
        rows = await cursor.fetchall()
    return [json.loads(row[0]) for row in rows]
