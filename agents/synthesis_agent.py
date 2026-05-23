from __future__ import annotations

import json

from backend.gemini_client import call_gemini_text

SEVERITY_SCORE = {
    "none": -1,
    "info": 0,
    "low": 1,
    "warning": 2,
    "medium": 2,
    "critical": 3,
    "high": 3,
}


def normalize_severity(value: str | None) -> str:
    severity = (value or "info").lower()
    if severity in {"critical", "high"}:
        return "critical"
    if severity in {"warning", "medium"}:
        return "warning"
    return "info"


def calculate_overall_severity(*finding_groups: list[dict]) -> str:
    overall = "none"
    for group in finding_groups:
        for finding in group:
            severity = normalize_severity(finding.get("severity"))
            if SEVERITY_SCORE[severity] > SEVERITY_SCORE[overall]:
                overall = severity
    return overall


async def generate_summary_text(review: dict) -> str:
    system = (
        "You are SilentReviewer, a concise AI pull request reviewer. "
        "Generate a human-readable 3-4 line summary for the top of a GitHub PR comment."
    )
    prompt = (
        "Summarize this structured review. Mention the overall severity and the most important "
        "security, architecture, test, or consistency concerns. Do not use a table.\n\n"
        f"{json.dumps(review, indent=2)}"
    )
    try:
        return await call_gemini_text(prompt=prompt, system=system, max_tokens=300)
    except Exception as exc:
        return (
            f"SilentReviewer completed the review. Overall severity: {review['overall_severity']}. "
            f"Gemini summary generation failed: {exc}"
        )


async def synthesize_findings(
    security: list[dict],
    architecture: list[dict],
    test_gaps: list[dict],
    consistency: list[dict],
) -> dict:
    review = {
        "overall_severity": calculate_overall_severity(
            security,
            architecture,
            test_gaps,
            consistency,
        ),
        "security": security,
        "architecture": architecture,
        "test_gaps": test_gaps,
        "consistency": consistency,
        "summary_text": "",
    }
    review["summary_text"] = await generate_summary_text(review)
    return review
