from __future__ import annotations

import hashlib
import hmac
import json
import os

from fastapi import APIRouter, Header, HTTPException, Request

from agents.orchestrator import review_diff
from backend.schemas import ManualReviewRequest, WebhookAck

router = APIRouter()


def verify_github_signature(body: bytes, signature_header: str | None) -> None:
    webhook_secret = os.getenv("GITHUB_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(
            status_code=500,
            detail="GITHUB_WEBHOOK_SECRET is not configured.",
        )
    if not signature_header:
        raise HTTPException(status_code=401, detail="Missing X-Hub-Signature-256 header.")

    expected_signature = "sha256=" + hmac.new(
        webhook_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, signature_header):
        raise HTTPException(status_code=401, detail="Invalid GitHub webhook signature.")


@router.post("/webhook", response_model=WebhookAck)
async def github_webhook(
    request: Request,
    x_github_event: str = Header(default="unknown"),
    x_hub_signature_256: str | None = Header(default=None),
):
    body = await request.body()
    verify_github_signature(body, x_hub_signature_256)

    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.") from exc

    action = payload.get("action")
    repo_name = payload.get("repository", {}).get("full_name")
    pr_number = payload.get("pull_request", {}).get("number")

    print(
        "GitHub webhook received:",
        {"event": x_github_event, "action": action, "repo": repo_name, "pr_number": pr_number},
    )

    if x_github_event == "pull_request" and action in {"opened", "synchronize", "reopened"}:
        # Phase 1 only acknowledges the event. Phase 2 will fetch the PR diff and post a review.
        return WebhookAck(
            status="accepted",
            event=x_github_event,
            action=action,
            message=f"PR event accepted for {repo_name}#{pr_number}.",
        )

    return WebhookAck(
        status="ignored",
        event=x_github_event,
        action=action,
        message="Event received but not handled by Phase 1.",
    )


@router.post("/review")
async def manual_review(request: ManualReviewRequest):
    return await review_diff(
        diff=request.diff,
        repo=request.repo,
        pr_number=request.pr_number,
    )
