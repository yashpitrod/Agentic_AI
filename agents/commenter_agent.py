from __future__ import annotations

import html
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()


def format_markdown_review(synthesis_json: dict) -> str:
    """
    Build GitHub-flavored markdown for the final SilentReviewer PR comment.

    Expected input shape:
    {
        "overall_severity": "Critical",
        "findings": {
            "security": [...],
            "architecture": [...],
            "test_gaps": [...],
            "context": [...]
        }
    }
    """
    severity = str(synthesis_json.get("overall_severity") or "Clean").strip()
    findings = synthesis_json.get("findings") or {}

    badge_color = {
        "critical": "red",
        "high": "red",
        "warning": "orange",
        "medium": "orange",
        "low": "yellow",
        "info": "blue",
        "clean": "brightgreen",
        "none": "lightgrey",
    }.get(severity.lower(), "blue")
    badge_label = severity.replace("_", " ").replace("-", " ").title().replace(" ", "%20")

    sections = [
        ("security", "🔴", "Security"),
        ("architecture", "🟠", "Architecture"),
        ("test_gaps", "🟡", "Test Gaps"),
        ("context", "🔵", "Context"),
    ]

    markdown_lines = [
        "## 🤖 SilentReviewer Analysis",
        "",
        f"![Overall Severity: {html.escape(severity)}](https://img.shields.io/badge/Overall%20Severity-{badge_label}-{badge_color}?style=for-the-badge)",
        "",
    ]

    for key, icon, title in sections:
        items = findings.get(key) or []
        issue_word = "issue" if len(items) == 1 else "issues"

        markdown_lines.extend(
            [
                "<details>",
                f"<summary>{icon} {title} ({len(items)} {issue_word})</summary>",
                "",
            ]
        )

        if not items:
            markdown_lines.append("- No findings.")
        else:
            for item in items:
                if isinstance(item, dict):
                    severity_text = item.get("severity")
                    location = item.get("file") or item.get("location")
                    line_hint = item.get("line_hint") or item.get("line")
                    description = (
                        item.get("description")
                        or item.get("issue")
                        or item.get("missing_test")
                        or item.get("message")
                        or item.get("summary")
                        or item.get("violation_type")
                        or item.get("issue_type")
                    )
                    suggestion = (
                        item.get("suggestion")
                        or item.get("recommendation")
                        or item.get("refactor_suggestion")
                    )

                    parts: list[str] = []
                    if severity_text:
                        parts.append(f"**Severity:** {html.escape(str(severity_text))}")
                    if location:
                        location_text = str(location)
                        if line_hint and str(line_hint).strip().isdigit():
                            location_text = f"{location_text}:{line_hint}"
                        parts.append(f"**Location:** `{html.escape(location_text)}`")
                    if description:
                        parts.append(html.escape(str(description)))
                    if line_hint and not str(line_hint).strip().isdigit():
                        parts.append(f"**Hint:** `{html.escape(str(line_hint))}`")
                    if suggestion:
                        parts.append(f"**Suggestion:** {html.escape(str(suggestion))}")

                    markdown_lines.append(f"- {' - '.join(parts) if parts else html.escape(str(item))}")
                else:
                    markdown_lines.append(f"- {html.escape(str(item))}")

        markdown_lines.extend(["", "</details>", ""])

    return "\n".join(markdown_lines).rstrip() + "\n"


def post_github_comment(repo_name: str, pr_number: int, comment_body: str) -> dict:
    """
    Post the review markdown to a GitHub Pull Request using Issue Comments API.

    Pull requests are issues in GitHub's REST API, so the correct endpoint is:
    POST /repos/{owner}/{repo}/issues/{issue_number}/comments
    """
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN not found in environment variables.")
    if "/" not in repo_name:
        raise ValueError("repo_name must be in 'owner/repo' format.")
    if not comment_body.strip():
        raise ValueError("comment_body cannot be empty.")

    response = requests.post(
        f"https://api.github.com/repos/{repo_name}/issues/{pr_number}/comments",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "SilentReviewer",
        },
        json={"body": comment_body},
        timeout=20,
    )

    try:
        response.raise_for_status()
    except requests.HTTPError as exc:
        raise ValueError(
            f"Failed to post GitHub comment to {repo_name}#{pr_number}: "
            f"{response.status_code} {response.text}"
        ) from exc

    return response.json()


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    dummy_synthesis = {
        "overall_severity": "Critical",
        "findings": {
            "security": [
                {
                    "issue_type": "Hardcoded Secret",
                    "severity": "critical",
                    "file": "main.py",
                    "description": "Hardcoded password detected in code.",
                    "line_hint": '+ password = "admin123"',
                }
            ],
            "architecture": [
                {
                    "violation_type": "SRP Violation",
                    "severity": "warning",
                    "description": "One function is handling email and database persistence together.",
                    "refactor_suggestion": "Split the work into focused service functions.",
                }
            ],
            "test_gaps": [
                {
                    "function": "send_email_and_save_user_to_db",
                    "file": "main.py",
                    "missing_test": "No test covers the newly added function.",
                }
            ],
            "context": [],
        },
    }

    markdown = format_markdown_review(dummy_synthesis)
    print(markdown)

    if len(sys.argv) >= 3:
        repo_arg = sys.argv[1]
        pr_arg = int(sys.argv[2])
        result = post_github_comment(repo_arg, pr_arg, markdown)
        print(f"Posted comment: {result.get('html_url', '[no html_url returned]')}")
    else:
        print("To post this dummy comment, run: python agents/commenter_agent.py <owner/repo> <pr_number>")
