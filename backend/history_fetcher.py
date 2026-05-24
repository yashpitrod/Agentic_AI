from __future__ import annotations

import asyncio
import logging
import os
import re
import sys

import httpx
from dotenv import load_dotenv
from github import Github, GithubException, Auth

load_dotenv()

logger = logging.getLogger(__name__)

# In-memory cache: repo_name -> compiled historical codebase structure text
_historical_structure_cache: dict[str, str] = {}


def extract_structural_elements(diff_text: str) -> dict[str, list[str]]:
    # Parse a raw git diff and extract added class names, function names, and import statements
    classes: list[str] = []
    functions: list[str] = []
    imports: list[str] = []

    class_pat = re.compile(r'^\+\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)')
    func_pat = re.compile(r'^\+\s*(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)')
    import_pat = re.compile(r'^\+\s*(import\s+.+|from\s+.+\s+import\s+.+)')

    for line in diff_text.splitlines():
        if line.startswith('+') and not line.startswith('+++'):
            imp_match = import_pat.match(line)
            if imp_match:
                imports.append(imp_match.group(1).strip())
                continue
            cls_match = class_pat.match(line)
            if cls_match:
                classes.append(cls_match.group(1))
                continue
            fn_match = func_pat.match(line)
            if fn_match:
                functions.append(fn_match.group(1))
                continue

    return {
        "classes": sorted(list(set(classes))),
        "functions": sorted(list(set(functions))),
        "imports": sorted(list(set(imports))),
    }


async def fetch_historical_prs(repo_name: str, limit: int = 15) -> list[dict]:
    # Fetch the last N merged PRs from the GitHub repository
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN not found in environment variables or .env file.")

    # PyGitHub is synchronous — run metadata fetching in a thread
    def _fetch_pr_list():
        auth = Auth.Token(token)
        g = Github(auth=auth)
        try:
            repo = g.get_repo(repo_name)
        except GithubException as e:
            raise ValueError(f"Cannot access repository '{repo_name}': {e.data.get('message', str(e))}")
        pulls = repo.get_pulls(state='closed', sort='created', direction='desc')
        pr_meta = []
        count = 0
        for pr in pulls:
            if count >= limit:
                break
            if not pr.merged:
                continue
            pr_meta.append({
                "number": pr.number,
                "title": pr.title,
                "author": pr.user.login,
                "body": pr.body or "",
                "url": pr.url,
            })
            count += 1
        return pr_meta

    pr_meta_list = await asyncio.to_thread(_fetch_pr_list)

    # Fetch diffs asynchronously via httpx
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3.diff",
    }

    pr_list: list[dict] = []
    async with httpx.AsyncClient(timeout=15) as client:
        for pr_meta in pr_meta_list:
            logger.debug("Fetching diff for PR #%d...", pr_meta["number"])
            try:
                response = await client.get(pr_meta["url"], headers=headers)
                response.raise_for_status()
                diff_text = response.text
            except Exception as e:
                logger.warning("Failed to fetch diff for PR #%d: %s", pr_meta["number"], e)
                diff_text = ""

            pr_list.append({**pr_meta, "diff_text": diff_text})

    return pr_list


async def get_historical_codebase_structure(repo_name: str, limit: int = 15) -> str:
    # Fetch historical PRs, extract structural elements, compile into a text summary, and cache
    if repo_name in _historical_structure_cache:
        logger.debug("Cache hit for historical structure of '%s'", repo_name)
        return _historical_structure_cache[repo_name]

    logger.info("Cache miss — fetching last %d merged PRs for '%s'...", limit, repo_name)
    prs = await fetch_historical_prs(repo_name, limit)

    if not prs:
        empty_msg = f"No merged Pull Requests found in repository '{repo_name}'."
        _historical_structure_cache[repo_name] = empty_msg
        return empty_msg

    compiled_lines = [
        f"HISTORICAL CODEBASE STRUCTURE FOR: {repo_name}",
        f"Analyzed Last {len(prs)} Merged Pull Requests",
        "=" * 60,
        "",
    ]

    for pr in prs:
        struct = extract_structural_elements(pr["diff_text"])
        compiled_lines.extend([
            f"--- PR #{pr['number']}: {pr['title']} ---",
            f"Author: {pr['author']}",
            f"Description: {pr['body'].strip()[:200]}..." if pr['body'] else "Description: [No description]",
            "Structural Additions:",
        ])
        if struct["imports"]:
            compiled_lines.append("  Added Imports:")
            for imp in struct["imports"]:
                compiled_lines.append(f"    - {imp}")
        if struct["classes"]:
            compiled_lines.append("  Added Classes:")
            for cls in struct["classes"]:
                compiled_lines.append(f"    - {cls}")
        if struct["functions"]:
            compiled_lines.append("  Added Functions:")
            for fn in struct["functions"]:
                compiled_lines.append(f"    - {fn}")
        if not struct["imports"] and not struct["classes"] and not struct["functions"]:
            compiled_lines.append("  [No structural additions extracted from diff]")
        compiled_lines.append("-" * 40)
        compiled_lines.append("")

    compiled_text = "\n".join(compiled_lines)
    _historical_structure_cache[repo_name] = compiled_text
    return compiled_text


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python backend/history_fetcher.py <owner/repo>")
        sys.exit(1)

    target_repo = sys.argv[1]

    async def _main():
        structure = await get_historical_codebase_structure(target_repo, limit=3)
        print("\n".join(structure.splitlines()[:50]))

    asyncio.run(_main())
