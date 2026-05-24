from __future__ import annotations

import asyncio
import logging
import os
import sys

import httpx
from dotenv import load_dotenv

from backend.schemas import PRData

load_dotenv()

logger = logging.getLogger(__name__)


def _github_headers(accept: str) -> dict[str, str]:
    token = os.getenv("GITHUB_TOKEN")
    headers = {
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "SilentReviewer",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _access_error(repo_name: str, pr_number: int, action: str, status_code: int) -> ValueError:
    if status_code == 403:
        return ValueError(
            f"Cannot {action} PR #{pr_number} in '{repo_name}' (403). "
            "For private repos or higher rate limits, configure GITHUB_TOKEN."
        )
    return ValueError(f"Cannot {action} PR #{pr_number} in '{repo_name}' ({status_code}).")


async def fetch_pr_data(repo_name: str, pr_number: int) -> PRData:
    # A token is optional here: public repos can be reviewed without auth.
    pr_api_url = f"https://api.github.com/repos/{repo_name}/pulls/{pr_number}"

    async with httpx.AsyncClient(timeout=15) as client:
        metadata_response = await client.get(
            pr_api_url,
            headers=_github_headers("application/vnd.github+json"),
        )
        if metadata_response.status_code in {403, 404}:
            raise _access_error(repo_name, pr_number, "access", metadata_response.status_code)
        metadata_response.raise_for_status()
        metadata = metadata_response.json()

        diff_response = await client.get(
            pr_api_url,
            headers=_github_headers("application/vnd.github.v3.diff"),
        )
        if diff_response.status_code in {403, 404}:
            raise _access_error(repo_name, pr_number, "fetch diff for", diff_response.status_code)
        diff_response.raise_for_status()
        diff_text = diff_response.text

    logger.info("Fetched PR #%d from %s (%d chars diff)", pr_number, repo_name, len(diff_text))

    return PRData(
        repo_name=repo_name,
        pr_number=pr_number,
        diff_text=diff_text,
        pr_title=metadata.get("title") or "",
        author=(metadata.get("user") or {}).get("login") or "",
    )


async def post_pr_comment(repo_name: str, pr_number: int, body: str) -> None:
    # Post a comment to a GitHub PR using the Issue Comments API
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN not found in environment variables or .env file.")

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"https://api.github.com/repos/{repo_name}/issues/{pr_number}/comments",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "SilentReviewer",
            },
            json={"body": body},
        )
        response.raise_for_status()

    logger.info("Posted comment to %s#%d", repo_name, pr_number)


if __name__ == "__main__":
    # Small test CLI
    if len(sys.argv) < 3:
        print("Usage: python backend/github_fetcher.py <owner/repo> <pr_number>")
        sys.exit(1)

    target_repo = sys.argv[1]
    try:
        target_pr = int(sys.argv[2])
    except ValueError:
        print("PR number must be an integer.")
        sys.exit(1)

    async def _main():
        pr_data = await fetch_pr_data(target_repo, target_pr)
        print(f"Title:  {pr_data.pr_title}")
        print(f"Author: {pr_data.author}")
        print(f"Diff:   {len(pr_data.diff_text)} characters")

    asyncio.run(_main())
