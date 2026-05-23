from __future__ import annotations

import os
from github import Github, Auth

def format_markdown_review(synthesis_json: dict) -> str:
    """
    Formats the structured synthesis JSON into a polished, neubrutalist-style
    collapsible HTML details Markdown layout for posting onto GitHub.
    """
    severity = synthesis_json.get("overall_severity", "Clean").upper()
    findings = synthesis_json.get("findings", {})
    
    lines = [
        "## 🤖 SilentReviewer Automated PR Review",
        "",
        f"**Overall Severity Status:** {severity}",
        ""
    ]
    
    # 1. Security Findings
    security_items = findings.get("security", [])
    lines.append("### 🔴 Security Agent Findings")
    if not security_items:
        lines.append("- No security issues detected.")
    else:
        for f in security_items:
            lines.append(
                f"<details>\n"
                f"<summary><b>[{f.get('severity', 'WARNING').upper()}] {f.get('issue_type', 'Vulnerability')}</b> in <code>{f.get('file', 'unknown')}</code></summary>\n\n"
                f"* **Description:** {f.get('description', '')}\n"
                f"* **Line Hint:**\n"
                f"  ```python\n"
                f"  {f.get('line_hint', '')}\n"
                f"  ```\n"
                f"</details>\n"
            )
            
    # 2. Architecture Findings
    architecture_items = findings.get("architecture", [])
    lines.append("### 🟡 Architecture Agent Findings")
    if not architecture_items:
        lines.append("- No architectural issues detected.")
    else:
        for f in architecture_items:
            lines.append(
                f"<details>\n"
                f"<summary><b>[{f.get('severity', 'WARNING').upper()}] {f.get('violation_type', 'Violation')}</b></summary>\n\n"
                f"* **Description:** {f.get('description', '')}\n"
                f"* **Refactor Suggestion:** *{f.get('refactor_suggestion', '')}*\n"
                f"</details>\n"
            )
            
    # 3. Test Gap Alerts
    test_items = findings.get("test_gaps", [])
    lines.append("### 🟢 Test Gap Detector Alerts")
    if not test_items:
        lines.append("- No test coverage gaps found.")
    else:
        for f in test_items:
            lines.append(
                f"<details>\n"
                f"<summary><b>[WARNING] Missing Coverage</b> for <code>{f.get('function', '')}</code> in <code>{f.get('file', 'unknown')}</code></summary>\n\n"
                f"* **Description:** This newly added or modified function lacks corresponding test coverage.\n"
                f"* **Missing Scenario:** {f.get('missing_test', '')}\n"
                f"</details>\n"
            )
            
    # 4. Consistency Findings
    context_items = findings.get("context", [])
    lines.append("### 🔵 Stylistic Consistency Findings")
    if not context_items:
        lines.append("- No style or consistency issues detected.")
    else:
        for f in context_items:
            lines.append(
                f"<details>\n"
                f"<summary><b>[{f.get('severity', 'INFO').upper()}] Style Inconsistency</b> in <code>{f.get('location', 'unknown')}</code></summary>\n\n"
                f"* **Description:** {f.get('issue', '')}\n"
                f"</details>\n"
            )
            
    return "\n".join(lines)


def post_github_comment(repo_name: str, pr_number: int, comment_body: str):
    """
    Posts the formatted review comment to the specified GitHub Pull Request
    using the standard, lightweight Issue Comments API.
    """
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN is not configured.")
        
    auth = Auth.Token(token)
    g = Github(auth=auth)
    
    # PRs are issues in the GitHub API, so get_issue gets the PR directly
    # and posts a clean comment on the PR timeline.
    repo = g.get_repo(repo_name)
    issue = repo.get_issue(pr_number)
    return issue.create_comment(comment_body)
