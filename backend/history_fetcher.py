from __future__ import annotations

import os
import re
import sys
import requests
from dotenv import load_dotenv
from github import Github, GithubException, Auth

# Load environment variables
load_dotenv()

# Global in-memory cache: repo_name -> compiled historical codebase structure text
_historical_structure_cache: dict[str, str] = {}

def extract_structural_elements(diff_text: str) -> dict[str, list[str]]:
    """
    Parses a raw git diff and uses regex to extract ONLY added class names,
    function/method names, and import statements to keep the context size small.
    
    Args:
        diff_text (str): The raw unified diff string of the PR.
        
    Returns:
        dict: Lists of extracted classes, functions, and imports.
    """
    classes: list[str] = []
    functions: list[str] = []
    imports: list[str] = []

    # Compile regex patterns
    # Match added classes: class ClassName(Base):
    class_pat = re.compile(r'^\+\s*class\s+([a-zA-Z_][a-zA-Z0-9_]*)')
    # Match added functions: def func_name(args): or async def func_name(args):
    func_pat = re.compile(r'^\+\s*(?:async\s+)?def\s+([a-zA-Z_][a-zA-Z0-9_]*)')
    # Match added imports: import package or from package import module
    import_pat = re.compile(r'^\+\s*(import\s+.+|from\s+.+\s+import\s+.+)')

    for line in diff_text.splitlines():
        # Only parse added lines, excluding the file header (+++)
        if line.startswith('+') and not line.startswith('+++'):
            # 1. Check for import statements
            imp_match = import_pat.match(line)
            if imp_match:
                imports.append(imp_match.group(1).strip())
                continue
            
            # 2. Check for class definitions
            cls_match = class_pat.match(line)
            if cls_match:
                classes.append(cls_match.group(1))
                continue
                
            # 3. Check for function definitions
            fn_match = func_pat.match(line)
            if fn_match:
                functions.append(fn_match.group(1))
                continue

    # De-duplicate elements while preserving order or general sets
    return {
        "classes": sorted(list(set(classes))),
        "functions": sorted(list(set(functions))),
        "imports": sorted(list(set(imports)))
    }

def fetch_historical_prs(repo_name: str, limit: int = 15) -> list[dict]:
    """
    Fetches the last N merged/closed PRs from the GitHub repository.
    Extracts PR details: number, title, author, body, and raw diff text.
    
    Args:
        repo_name (str): Repository name in format 'owner/repo'
        limit (int): Number of PRs to fetch
        
    Returns:
        list[dict]: List of PR data dictionaries.
    """
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN not found in environment variables or .env file.")

    # Authenticate with PyGitHub
    auth = Auth.Token(token)
    g = Github(auth=auth)

    try:
        repo = g.get_repo(repo_name)
    except GithubException as e:
        raise ValueError(f"Could not find or access repository '{repo_name}': {e.data.get('message', str(e))}")

    # Fetch closed pull requests (sorted by created date descending)
    try:
        pulls = repo.get_pulls(state='closed', sort='created', direction='desc')
    except GithubException as e:
        raise ValueError(f"Failed to retrieve pull requests for '{repo_name}': {e.data.get('message', str(e))}")

    pr_list: list[dict] = []
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3.diff"
    }

    count = 0
    for pr in pulls:
        if count >= limit:
            break
        
        # We only want merged pull requests or closed ones that have valid diffs
        # Checking pr.merged makes sure they were actually integrated
        if not pr.merged:
            continue

        print(f"Fetching diff for PR #{pr.number} (Count: {count + 1}/{limit})...")
        
        # Fetch raw diff via REST API using Accept header
        try:
            response = requests.get(pr.url, headers=headers, timeout=15)
            response.raise_for_status()
            diff_text = response.text
        except Exception as e:
            print(f"Warning: Failed to fetch diff for PR #{pr.number}: {e}")
            diff_text = ""

        pr_list.append({
            "number": pr.number,
            "title": pr.title,
            "author": pr.user.login,
            "body": pr.body or "",
            "diff_text": diff_text
        })
        count += 1

    return pr_list

def get_historical_codebase_structure(repo_name: str, limit: int = 15) -> str:
    """
    Fetches historical PRs, extracts structural elements, compiles them into
    a single raw text representation of 'Historical Codebase Structure', and caches
    the result to prevent hitting GitHub's rate limits.
    
    Args:
        repo_name (str): Repository name in format 'owner/repo'
        limit (int): Number of PRs to analyze
        
    Returns:
        str: Compiled raw text representing codebase personality/history.
    """
    if repo_name in _historical_structure_cache:
        print(f"[CACHE HIT] Returning cached codebase structure for '{repo_name}'")
        return _historical_structure_cache[repo_name]

    print(f"[CACHE MISS] Fetching last {limit} merged PRs for '{repo_name}'...")
    prs = fetch_historical_prs(repo_name, limit)
    
    if not prs:
        empty_msg = f"No merged Pull Requests found in repository '{repo_name}'."
        _historical_structure_cache[repo_name] = empty_msg
        return empty_msg

    compiled_lines = [
        f"HISTORICAL CODEBASE STRUCTURE FOR: {repo_name}",
        f"Analyzed Last {len(prs)} Merged Pull Requests",
        "=" * 60,
        ""
    ]

    for pr in prs:
        struct = extract_structural_elements(pr["diff_text"])
        
        compiled_lines.extend([
            f"--- PR #{pr['number']}: {pr['title']} ---",
            f"Author: {pr['author']}",
            f"Description: {pr['body'].strip()[:200]}..." if pr['body'] else "Description: [No description]",
            "Structural Additions:"
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
    
    # Store in cache
    _historical_structure_cache[repo_name] = compiled_text
    return compiled_text

if __name__ == "__main__":
    # Test execution
    if len(sys.argv) < 2:
        print("Usage: python backend/history_fetcher.py <owner/repo>")
        sys.exit(1)
        
    target_repo = sys.argv[1]
    try:
        structure = get_historical_codebase_structure(target_repo, limit=3)
        print("\n=== COMPILED HISTORICAL CODEBASE STRUCTURE (Preview) ===")
        print("\n".join(structure.splitlines()[:50]))
        print("\n... [Preview truncated] ...")
        
        # Test Cache Hit
        print("\nTesting in-memory cache hit:")
        get_historical_codebase_structure(target_repo, limit=3)
    except Exception as err:
        print(f"Error: {err}", file=sys.stderr)
        sys.exit(1)
