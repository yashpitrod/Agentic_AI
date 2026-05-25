from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import aiosqlite
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.review_store import init_db, _db_path
from backend.routes import router
from backend.oauth import oauth_router

load_dotenv()

# Configure root logger for the whole application
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Startup: initialise the SQLite database
    logger.info("Starting SilentReviewer — initialising database...")
    await init_db()
    yield
    # Shutdown: nothing to clean up for SQLite
    logger.info("SilentReviewer shutting down.")


app = FastAPI(
    title="SilentReviewer",
    description="Async PR review agent webhook receiver and demo API.",
    lifespan=lifespan,
)

# CORS origins from env var (comma-separated), defaulting to localhost
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(oauth_router)


@app.get("/health")
async def health():
    db_alive = "disconnected"
    try:
        # Ping SQLite database to verify active connection
        async with aiosqlite.connect(_db_path) as db:
            await db.execute("SELECT 1")
        db_alive = "connected"
    except Exception:
        pass

    return {
        "status": "ok",
        "database": db_alive,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
