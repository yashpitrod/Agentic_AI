"""
Review persistence layer — MongoDB via Motor (async driver).

Replaces the previous SQLite-based store with a cloud-hosted MongoDB database
so that reviews persist across server restarts and deploys.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorClient

logger = logging.getLogger(__name__)

# Module-level references to the MongoDB client and database
_client: AsyncIOMotorClient | None = None
_db = None


async def init_db() -> None:
    """Connect to MongoDB and ensure indexes exist."""
    global _client, _db

    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI environment variable is not set.")

    _client = AsyncIOMotorClient(uri)
    _db = _client.silentreviewer

    # Create index on 'id' for fast lookups and on 'created_at' for sorting
    await _db.reviews.create_index("id", unique=True)
    await _db.reviews.create_index("created_at")
    await _db.reviews.create_index("user_email")

    # Ping to verify connection
    await _client.admin.command("ping")
    logger.info("MongoDB connected — database: silentreviewer")


async def close_db() -> None:
    """Close the MongoDB connection cleanly."""
    global _client
    if _client:
        _client.close()
        _client = None
        logger.info("MongoDB connection closed.")


async def save_review(review: dict, user_email: str | None = None) -> dict:
    """Persist a review document and return the enriched record."""
    review_id = str(uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    stored = {
        "id": review_id,
        "created_at": created_at,
        "user_email": user_email,
        **review,
    }

    await _db.reviews.insert_one(stored)

    # Remove MongoDB's internal _id before returning
    stored.pop("_id", None)
    logger.info("Review %s saved (user=%s)", review_id, user_email or "anonymous")
    return stored


async def list_reviews(user_email: str | None = None) -> list[dict]:
    """Retrieve reviews, optionally filtered by user email."""
    query = {}
    if user_email:
        query["user_email"] = user_email

    cursor = _db.reviews.find(query).sort("created_at", -1).limit(50)
    reviews = await cursor.to_list(length=50)

    # Remove MongoDB's internal _id from each document
    for r in reviews:
        r.pop("_id", None)

    return reviews


async def get_review_by_id(review_id: str) -> dict | None:
    """Retrieve a single review by its unique ID."""
    doc = await _db.reviews.find_one({"id": review_id})
    if doc:
        doc.pop("_id", None)
        return doc
    return None
