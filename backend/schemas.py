from __future__ import annotations

from pydantic import BaseModel, Field


# -- Webhook payload and acknowledgement --
class PRData(BaseModel):
    repo_name: str
    pr_number: int
    diff_text: str
    pr_title: str
    author: str
    post_comment: bool = False


class ManualReviewRequest(BaseModel):
    diff: str = Field(..., min_length=1, description="Unified git diff text to review.")
    repo: str | None = Field(default=None, description="Optional owner/repo name.")
    pr_number: int | None = Field(default=None, description="Optional pull request number.")


class PRReviewRequest(BaseModel):
    repo: str = Field(..., min_length=3, description="GitHub repository in owner/repo format.")
    pr_number: int = Field(..., ge=1, description="GitHub pull request number.")
    post_comment: bool = Field(default=False, description="Post the generated review as a GitHub PR comment.")


class WebhookAck(BaseModel):
    status: str
    event: str
    action: str | None = None
    message: str


# -- Review response models --
class FindingItem(BaseModel):
    agent: str
    severity: str
    title: str
    details: str
    file: str = ""
    line_hint: str = ""


class ReviewSummary(BaseModel):
    finding_count: int
    highest_severity: str
    skipped_agents: list[str] = []


class ReviewResponse(BaseModel):
    id: str = ""
    created_at: str = ""
    repo: str
    pr_number: int
    summary: ReviewSummary
    findings: list[FindingItem]
    markdown: str


class ReviewListResponse(BaseModel):
    count: int
    reviews: list[dict]
