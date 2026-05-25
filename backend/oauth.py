"""
GitHub OAuth App flow for SilentReviewer.

This module handles user authentication via a GitHub OAuth App (separate from the
existing webhook GitHub App) and lets authenticated users install a webhook on
their own repositories.

Endpoints:
    GET  /auth/github          — Redirect to GitHub OAuth authorize page
    GET  /auth/github/callback — Handle GitHub callback, exchange code for token
    POST /api/connect-repo     — Install SilentReviewer webhook on a user's repo
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

oauth_router = APIRouter()

# ---------------------------------------------------------------------------
# In-memory stores (acceptable for portfolio / free-tier deploys)
# ---------------------------------------------------------------------------

# Maps state param -> timestamp (for CSRF protection during OAuth flow)
_pending_states: dict[str, str] = {}

# Maps session_id -> GitHub access token (for authenticated API calls)
_oauth_sessions: dict[str, str] = {}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class ConnectRepoRequest(BaseModel):
    repo_name: str = Field(
        ...,
        min_length=3,
        description="GitHub repository in owner/repo format.",
    )
    session_id: str = Field(
        ...,
        min_length=1,
        description="OAuth session ID received after authentication.",
    )


class ConnectRepoResponse(BaseModel):
    success: bool
    repo: str
    message: str


# ---------------------------------------------------------------------------
# Helper — read env vars with clear error messages
# ---------------------------------------------------------------------------

def _require_env(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise HTTPException(
            status_code=500,
            detail=f"Server misconfiguration: {key} is not set.",
        )
    return value


# ---------------------------------------------------------------------------
# GET /auth/github — Start OAuth flow
# ---------------------------------------------------------------------------

@oauth_router.get("/auth/github")
async def github_oauth_start():
    """Redirect the user's browser to GitHub's OAuth authorization page."""
    client_id = _require_env("GITHUB_CLIENT_ID")

    # Generate a random state token for CSRF protection
    state = secrets.token_urlsafe(32)
    _pending_states[state] = datetime.now(timezone.utc).isoformat()

    # Housekeeping: remove stale states (older than 10 minutes, keep dict small)
    _cleanup_stale_states()

    authorize_url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={client_id}"
        f"&scope=repo,write:repo_hook"
        f"&state={state}"
    )

    logger.info("OAuth flow started — redirecting to GitHub authorize page")
    return RedirectResponse(url=authorize_url, status_code=302)


# ---------------------------------------------------------------------------
# GET /auth/github/callback — Handle GitHub redirect
# ---------------------------------------------------------------------------

@oauth_router.get("/auth/github/callback")
async def github_oauth_callback(
    code: str = Query(..., description="Authorization code from GitHub"),
    state: str = Query(..., description="State parameter for CSRF validation"),
):
    """Exchange the authorization code for an access token and redirect to frontend."""
    client_id = _require_env("GITHUB_CLIENT_ID")
    client_secret = _require_env("GITHUB_CLIENT_SECRET")
    frontend_url = _require_env("FRONTEND_URL")

    # Validate state to prevent CSRF attacks
    if state not in _pending_states:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")
    del _pending_states[state]

    # Exchange the authorization code for an access token
    async with httpx.AsyncClient(timeout=15) as client:
        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
            },
        )

    if token_response.status_code != 200:
        logger.error("GitHub token exchange failed: %s", token_response.text)
        raise HTTPException(status_code=502, detail="Failed to exchange OAuth code.")

    token_data = token_response.json()
    access_token = token_data.get("access_token")

    if not access_token:
        error_desc = token_data.get("error_description", "Unknown error")
        logger.error("GitHub token exchange error: %s", error_desc)
        raise HTTPException(status_code=400, detail=f"GitHub OAuth error: {error_desc}")

    # Store the token under a unique session ID
    session_id = str(uuid4())
    _oauth_sessions[session_id] = access_token

    logger.info("OAuth flow completed — session %s created", session_id[:8])

    # Redirect to the frontend connect page with session ID
    redirect_url = f"{frontend_url.rstrip('/')}/connect?session={session_id}"
    return RedirectResponse(url=redirect_url, status_code=302)


# ---------------------------------------------------------------------------
# POST /api/connect-repo — Install webhook on user's repo
# ---------------------------------------------------------------------------

@oauth_router.post("/api/connect-repo", response_model=ConnectRepoResponse)
async def connect_repo(request: ConnectRepoRequest):
    """Use the user's OAuth token to install a webhook on their repository."""
    webhook_url = _require_env("WEBHOOK_URL")
    webhook_secret = os.getenv("GITHUB_WEBHOOK_SECRET", "")

    # Validate the session
    access_token = _oauth_sessions.get(request.session_id)
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session. Please reconnect with GitHub.",
        )

    # Validate repo format
    if "/" not in request.repo_name or request.repo_name.count("/") != 1:
        raise HTTPException(
            status_code=400,
            detail="Repository must be in owner/repo format (e.g. octocat/Hello-World).",
        )

    # Create webhook via GitHub API
    webhook_endpoint = f"{webhook_url.rstrip('/')}/webhook"
    repo = request.repo_name.strip()

    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            f"https://api.github.com/repos/{repo}/hooks",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "SilentReviewer",
            },
            json={
                "name": "web",
                "active": True,
                "events": ["pull_request"],
                "config": {
                    "url": webhook_endpoint,
                    "content_type": "json",
                    "secret": webhook_secret,
                    "insecure_ssl": "0",
                },
            },
        )

    if response.status_code == 201:
        logger.info("Webhook installed on %s", repo)
        return ConnectRepoResponse(
            success=True,
            repo=repo,
            message=f"SilentReviewer webhook installed on {repo}.",
        )
    elif response.status_code == 422:
        # 422 usually means the hook already exists
        logger.info("Webhook may already exist on %s (422)", repo)
        return ConnectRepoResponse(
            success=True,
            repo=repo,
            message=f"Webhook already exists on {repo}. You're all set!",
        )
    elif response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{repo}' not found or you don't have admin access.",
        )
    elif response.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail=f"Permission denied for '{repo}'. You need admin access to install webhooks.",
        )
    else:
        logger.error("Webhook creation failed (%d): %s", response.status_code, response.text)
        raise HTTPException(
            status_code=502,
            detail=f"GitHub API error ({response.status_code}). Please try again.",
        )


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _cleanup_stale_states() -> None:
    """Remove OAuth state tokens older than 10 minutes to prevent memory leaks."""
    now = datetime.now(timezone.utc)
    stale_keys = []
    for key, timestamp_str in _pending_states.items():
        try:
            created = datetime.fromisoformat(timestamp_str)
            if (now - created).total_seconds() > 600:
                stale_keys.append(key)
        except (ValueError, TypeError):
            stale_keys.append(key)
    for key in stale_keys:
        del _pending_states[key]
