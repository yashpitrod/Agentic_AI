from pydantic import BaseModel, Field


class ManualReviewRequest(BaseModel):
    diff: str = Field(..., min_length=1, description="Unified git diff text to review.")
    repo: str | None = Field(default=None, description="Optional owner/repo name.")
    pr_number: int | None = Field(default=None, description="Optional pull request number.")


class WebhookAck(BaseModel):
    status: str
    event: str
    action: str | None = None
    message: str
