import os
import sys
import requests
from dotenv import load_dotenv
from github import Github, GithubException
from backend.schemas import PRData

# Load environment variables from .env file
load_dotenv()

def fetch_pr_data(repo_name: str, pr_number: int) -> PRData:
    """
    Fetches raw pull request details (diff text, title, author) using PyGitHub
    and the GitHub REST API.
    
    Args:
        repo_name (str): Repository in the format 'owner/repo_name'
        pr_number (int): Pull Request number
        
    Returns:
        PRData: Pydantic model instance containing PR details.
    """
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN not found in environment variables or .env file.")
        
    # Authenticate with PyGitHub
    g = Github(token)
    
    try:
        # Fetch the repository
        repo = g.get_repo(repo_name)
    except GithubException as e:
        status_code = e.status
        message = e.data.get("message", str(e))
        raise ValueError(f"Could not find or access repository '{repo_name}' (Status: {status_code}): {message}")
        
    try:
        # Fetch the specific PR
        pr = repo.get_pull(pr_number)
    except GithubException as e:
        status_code = e.status
        message = e.data.get("message", str(e))
        raise ValueError(f"Could not find or access Pull Request #{pr_number} in '{repo_name}' (Status: {status_code}): {message}")
        
    # The raw diff can be fetched from GitHub REST API by using the Accept: application/vnd.github.v3.diff header
    # on the pull request resource URL.
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3.diff"
    }
    
    try:
        response = requests.get(pr.url, headers=headers, timeout=15)
        response.raise_for_status()
        diff_text = response.text
    except Exception as e:
        raise ValueError(f"Failed to fetch diff text for PR #{pr_number} from {pr.url}: {e}")

    # Return validated schema instance
    return PRData(
        repo_name=repo_name,
        pr_number=pr_number,
        diff_text=diff_text,
        pr_title=pr.title,
        author=pr.user.login
    )

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
        
    print(f"Fetching PR #{target_pr} from '{target_repo}'...")
    try:
        pr_data = fetch_pr_data(target_repo, target_pr)
        print("\n--- PR Metadata ---")
        print(f"Title:  {pr_data.pr_title}")
        print(f"Author: {pr_data.author}")
        print(f"Repo:   {pr_data.repo_name}")
        print(f"PR #:   {pr_data.pr_number}")
        print(f"Diff:   {len(pr_data.diff_text)} characters")
        print("\n--- Diff Preview (First 5 lines) ---")
        preview = "\n".join(pr_data.diff_text.splitlines()[:5])
        print(preview if preview else "[Empty Diff]")
    except Exception as err:
        print(f"\nError: {err}", file=sys.stderr)
        sys.exit(1)
