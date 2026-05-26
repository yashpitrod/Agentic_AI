"""
Google OAuth authentication for SilentReviewer.

Provides "Continue with Google" login flow and JWT-based session management.

Endpoints:
    GET  /auth/google          — Redirect to Google OAuth consent screen
    GET  /auth/google/callback — Handle Google redirect, issue JWT
    GET  /api/me               — Return current user info from JWT
"""

from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timezone, timedelta

import httpx
import jwt
from fastapi import APIRouter, HTTPException, Header, Query
from fastapi.responses import RedirectResponse

logger = logging.getLogger(__name__)

google_auth_router = APIRouter()

# In-memory CSRF state store (same pattern as GitHub OAuth)
_pending_states: dict[str, str] = {}

# JWT secret — derived from GOOGLE_CLIENT_SECRET for simplicity
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRY_DAYS = 30


def _jwt_secret() -> str:
    secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    if not secret:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_SECRET not set.")
    return secret


def create_jwt(user_data: dict) -> str:
    """Create a signed JWT containing user info."""
    payload = {
        **user_data,
        "exp": datetime.now(timezone.utc) + timedelta(days=_JWT_EXPIRY_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=_JWT_ALGORITHM)


def verify_jwt(token: str) -> dict | None:
    """Verify and decode a JWT. Returns user data or None."""
    try:
        return jwt.decode(token, _jwt_secret(), algorithms=[_JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def extract_user_email(authorization: str | None) -> str | None:
    """Extract user email from an Authorization header (Bearer token)."""
    if not authorization:
        return None
    if not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    user = verify_jwt(token)
    if user:
        return user.get("email")
    return None


# ---------------------------------------------------------------------------
# GET /auth/google — Start Google OAuth flow
# ---------------------------------------------------------------------------

@google_auth_router.get("/auth/google")
async def google_oauth_start():
    """Redirect the user to Google's OAuth consent screen."""
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    if not client_id:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not set.")

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # Determine the correct redirect URI based on the request context
    webhook_url = os.getenv("WEBHOOK_URL", "http://localhost:8000")
    base_url = webhook_url.rstrip('/')
    if base_url.endswith("/webhook"):
        base_url = base_url[:-8].rstrip('/')
    redirect_uri = f"{base_url}/auth/google/callback"

    state = secrets.token_urlsafe(32)
    _pending_states[state] = datetime.now(timezone.utc).isoformat()

    # Clean up old states
    _cleanup_states()

    authorize_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&state={state}"
        f"&access_type=offline"
        f"&prompt=consent"
    )

    logger.info("Google OAuth started — redirecting to consent screen")
    return RedirectResponse(url=authorize_url, status_code=302)


# ---------------------------------------------------------------------------
# GET /auth/google/callback — Handle Google redirect
# ---------------------------------------------------------------------------

@google_auth_router.get("/auth/google/callback")
async def google_oauth_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="CSRF state parameter"),
):
    """Exchange auth code for tokens, get user info, issue JWT."""
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    webhook_url = os.getenv("WEBHOOK_URL", "http://localhost:8000")
    base_url = webhook_url.rstrip('/')
    if base_url.endswith("/webhook"):
        base_url = base_url[:-8].rstrip('/')
    redirect_uri = f"{base_url}/auth/google/callback"

    # Validate CSRF state
    if state not in _pending_states:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")
    del _pending_states[state]

    # Exchange authorization code for tokens
    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        logger.error("Google token exchange failed: %s", token_resp.text)
        raise HTTPException(status_code=502, detail="Failed to exchange Google auth code.")

    token_data = token_resp.json()
    access_token = token_data.get("access_token")

    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received from Google.")

    # Get user info from Google
    async with httpx.AsyncClient(timeout=10) as client:
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if user_resp.status_code != 200:
        logger.error("Google userinfo failed: %s", user_resp.text)
        raise HTTPException(status_code=502, detail="Failed to get user info from Google.")

    user_info = user_resp.json()
    user_data = {
        "email": user_info.get("email", ""),
        "name": user_info.get("name", ""),
        "picture": user_info.get("picture", ""),
    }

    # Create JWT
    token = create_jwt(user_data)
    logger.info("Google OAuth completed for %s", user_data["email"])

    # Redirect to frontend with token
    redirect_url = f"{frontend_url.rstrip('/')}/?token={token}"
    return RedirectResponse(url=redirect_url, status_code=302)


# ---------------------------------------------------------------------------
# GET /api/me — Get current user info from JWT
# ---------------------------------------------------------------------------

@google_auth_router.get("/api/me")
async def get_current_user(authorization: str | None = Header(default=None)):
    """Return the current user's info from their JWT."""
    email = extract_user_email(authorization)
    if not email:
        raise HTTPException(status_code=401, detail="Not authenticated.")

    token = authorization[7:]  # Remove "Bearer "
    user = verify_jwt(token)
    return {
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "picture": user.get("picture", ""),
    }


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _cleanup_states() -> None:
    """Remove OAuth state tokens older than 10 minutes."""
    now = datetime.now(timezone.utc)
    stale = [
        k for k, v in _pending_states.items()
        if (now - datetime.fromisoformat(v)).total_seconds() > 600
    ]
    for k in stale:
        del _pending_states[k]
