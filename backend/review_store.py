from __future__ import annotations

from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4

_reviews: list[dict] = []
_lock = Lock()


def save_review(review: dict) -> dict:
    stored_review = {
        "id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        **review,
    }
    with _lock:
        _reviews.insert(0, stored_review)
    return stored_review


def list_reviews() -> list[dict]:
    with _lock:
        return list(_reviews)
