from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os

from fastapi import APIRouter, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

from agents.orchestrator import review_diff, review_pr_data
from backend.github_fetcher import fetch_pr_data
from backend.review_store import list_reviews, save_review, get_review_by_id
from backend.google_auth import extract_user_email
from backend.schemas import ManualReviewRequest, PRReviewRequest, ReviewListResponse, WebhookAck

logger = logging.getLogger(__name__)

router = APIRouter()


# Manage active websocket connections for real-time dashboard updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


def verify_github_signature(body: bytes, signature_header: str | None) -> None:
    # Validate the HMAC-SHA256 signature from the X-Hub-Signature-256 header
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

    logger.info(
        "GitHub webhook received: event=%s action=%s repo=%s pr=%s",
        x_github_event, action, repo_name, pr_number,
    )

    if x_github_event == "pull_request" and action in {"opened", "synchronize", "reopened"}:
        try:
            pr_data = await fetch_pr_data(repo_name, pr_number)
            review_result = await review_pr_data(pr_data)
            saved = await save_review(review_result)  # Webhook reviews have no user
            # Broadcast the completed review to all active websocket dashboard clients
            await manager.broadcast(saved)
            logger.info("Review completed — severity=%s", review_result.get("summary", {}).get("highest_severity"))
        except Exception as exc:
            logger.error("Review failed for %s#%s: %s", repo_name, pr_number, exc, exc_info=True)
            raise HTTPException(status_code=500, detail=f"Review failed: {exc}") from exc

        return WebhookAck(
            status="accepted",
            event=x_github_event,
            action=action,
            message=f"PR review completed for {repo_name}#{pr_number}.",
        )

    return WebhookAck(
        status="ignored",
        event=x_github_event,
        action=action,
        message="Event received but not handled.",
    )


@router.post("/review")
async def manual_review(request: ManualReviewRequest, authorization: str | None = Header(default=None)):
    user_email = extract_user_email(authorization)
    review_result = await review_diff(
        diff=request.diff,
        repo=request.repo,
        pr_number=request.pr_number,
    )
    saved = await save_review(review_result, user_email=user_email)
    # Broadcast the manual review to all active websocket dashboard clients
    await manager.broadcast(saved)
    return saved


@router.post("/review-pr")
async def review_pull_request(request: PRReviewRequest, authorization: str | None = Header(default=None)):
    user_email = extract_user_email(authorization)
    if "/" not in request.repo:
        raise HTTPException(status_code=400, detail="repo must be in owner/repo format.")

    try:
        pr_data = await fetch_pr_data(request.repo, request.pr_number)
        pr_data.post_comment = request.post_comment
        review_result = await review_pr_data(pr_data)
        saved = await save_review(review_result, user_email=user_email)
        await manager.broadcast(saved)
        return saved
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Real PR review failed for %s#%s: %s", request.repo, request.pr_number, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Review failed: {exc}") from exc


@router.post("/review-pr/stream")
async def review_pr_stream(request: PRReviewRequest, authorization: str | None = Header(default=None)):
    """SSE streaming endpoint that emits real-time progress events during PR review."""
    user_email = extract_user_email(authorization)
    if "/" not in request.repo:
        raise HTTPException(status_code=400, detail="repo must be in owner/repo format.")

    async def event_generator():
        # Stage 1: Fetching diff
        yield f"data: {json.dumps({'stage': 'fetching_diff', 'status': 'running', 'message': 'Fetching PR diff from GitHub...'})}\n\n"
        try:
            pr_data = await fetch_pr_data(request.repo, request.pr_number)
            pr_data.post_comment = request.post_comment
        except ValueError as exc:
            yield f"data: {json.dumps({'stage': 'fetching_diff', 'status': 'error', 'message': str(exc)})}\n\n"
            return
        except Exception as exc:
            yield f"data: {json.dumps({'stage': 'fetching_diff', 'status': 'error', 'message': str(exc)})}\n\n"
            return

        yield f"data: {json.dumps({'stage': 'fetching_diff', 'status': 'done', 'message': 'PR diff fetched successfully'})}\n\n"

        # Stage 2: Signal that all agents are starting (they run in parallel)
        yield f"data: {json.dumps({'stage': 'security', 'status': 'running', 'message': 'Running Security Agent...'})}\n\n"
        yield f"data: {json.dumps({'stage': 'architecture', 'status': 'running', 'message': 'Running Architecture Agent...'})}\n\n"
        yield f"data: {json.dumps({'stage': 'test_gaps', 'status': 'running', 'message': 'Checking test gaps...'})}\n\n"
        yield f"data: {json.dumps({'stage': 'consistency', 'status': 'running', 'message': 'Running Consistency Agent...'})}\n\n"

        # Stage 3: Run the full pipeline (agents execute in parallel inside)
        try:
            review_result = await review_pr_data(pr_data)
        except Exception as exc:
            logger.error("Stream review failed for %s#%s: %s", request.repo, request.pr_number, exc, exc_info=True)
            yield f"data: {json.dumps({'stage': 'pipeline', 'status': 'error', 'message': f'Review failed: {exc}'})}\n\n"
            return

        # Stage 4: Mark agents as done based on metrics
        metrics = review_result.get("state", {}).get("agent_metrics", {})
        for agent_key in ["security", "architecture", "test_gaps", "context"]:
            stage_name = "consistency" if agent_key == "context" else agent_key
            agent_metric = metrics.get(agent_key, {})
            agent_status = "done" if agent_metric.get("status") == "completed" else "skipped"
            agent_label = agent_key.replace("_", " ").title()
            event_data = json.dumps({"stage": stage_name, "status": agent_status, "message": f"{agent_label} Agent finished"})
            yield f"data: {event_data}\n\n"

        # Stage 5: Save and broadcast
        saved = await save_review(review_result, user_email=user_email)
        await manager.broadcast(saved)

        # Stage 6: Complete — send the review ID and full data
        complete_data = json.dumps({"stage": "complete", "status": "done", "review_id": saved.get("id", ""), "message": "Review complete"})
        yield f"data: {complete_data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/reviews", response_model=ReviewListResponse)
async def get_reviews(authorization: str | None = Header(default=None)):
    user_email = extract_user_email(authorization)
    reviews = await list_reviews(user_email=user_email)
    return ReviewListResponse(count=len(reviews), reviews=reviews)


@router.get("/reviews/{review_id}")
async def get_review(review_id: str):
    """Fetch a single review by ID."""
    review = await get_review_by_id(review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found.")
    return review


@router.websocket("/ws/reviews")
async def websocket_endpoint(websocket: WebSocket):
    # Accept and track new real-time dashboard client connections
    await manager.connect(websocket)
    try:
        while True:
            # Maintain active connection and detect client-side disconnection
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
