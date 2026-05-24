from __future__ import annotations

import asyncio
import logging
import os
import sys

import httpx
from dotenv import load_dotenv
from github import Github, GithubException

from backend.schemas import PRData

load_dotenv()

logger = logging.getLogger(__name__)


async def fetch_pr_data(repo_name: str, pr_number: int) -> PRData:
    # Fetch PR metadata via PyGitHub (sync, wrapped in to_thread) and diff via httpx
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN not found in environment variables or .env file.")

    # PyGitHub is synchronous — run in a thread pool
    def _fetch_metadata():
        g = Github(token)
        try:
            repo = g.get_repo(repo_name)
        except GithubException as e:
            msg = e.data.get("message", str(e))
            raise ValueError(f"Cannot access repository '{repo_name}' ({e.status}): {msg}")
        try:
            pr = repo.get_pull(pr_number)
        except GithubException as e:
            msg = e.data.get("message", str(e))
            raise ValueError(f"Cannot access PR #{pr_number} in '{repo_name}' ({e.status}): {msg}")
        return pr.title, pr.user.login, pr.url

    title, author, pr_api_url = await asyncio.to_thread(_fetch_metadata)

    # Fetch the raw diff via httpx (async)
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3.diff",
    }
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.get(pr_api_url, headers=headers)
        response.raise_for_status()
        diff_text = response.text

    logger.info("Fetched PR #%d from %s (%d chars diff)", pr_number, repo_name, len(diff_text))

    return PRData(
        repo_name=repo_name,
        pr_number=pr_number,
        diff_text=diff_text,
        pr_title=title,
        author=author,
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
