from __future__ import annotations

import json
import logging
import os
import sys

from pydantic import BaseModel, Field
from github import Github, Auth, GithubException
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    _HAS_GEMINI = True
except ImportError:
    _HAS_GEMINI = False


# -- Pydantic schemas for structured LLM output --

class ChangedElement(BaseModel):
    name: str = Field(..., description="Name of the newly added or modified function, method, or class.")
    file: str = Field(..., description="Filepath where this function or class is defined.")
    is_new: bool = Field(..., description="True if newly added; False if modified.")


class ChangedElementsList(BaseModel):
    elements: list[ChangedElement] = Field(default=[], description="All functions/classes added or modified in the PR.")


class TestGap(BaseModel):
    function: str = Field(..., description="Name of the function/class lacking test coverage.")
    file: str = Field(..., description="Filepath where this function/class is defined.")
    missing_test: str = Field(..., description="Brief description of what test coverage is missing.")


class TestGapsList(BaseModel):
    gaps: list[TestGap] = Field(default=[], description="All detected gaps in test coverage.")


# -- Diff element extraction (Helper 1) --

DIFF_SYSTEM_PROMPT = (
    "You are a precise developer assistant specializing in parsing git diffs. "
    "Your task is to analyze the provided Pull Request Diff and extract a list of all newly added "
    "or modified functions, methods, and classes. "
    "Ignore unrelated changes and return the output strictly conforming to the requested schema. "
    "Return an empty list if no functions or classes were added or modified."
)

DIFF_USER_PROMPT = (
    "Analyze this raw Pull Request Diff and extract all new or modified functions, methods, and classes:\n\n"
    "{pr_diff_text}"
)


def analyze_diff_elements(pr_diff_text: str) -> list[dict]:
    # Pass the raw diff to Gemini and return structured JSON of modified elements
    if not pr_diff_text.strip():
        return []

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not (gemini_key and _HAS_GEMINI):
        raise ValueError("GEMINI_API_KEY or langchain-google-genai is not configured.")

    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=gemini_key, temperature=0.0)
    structured_llm = llm.with_structured_output(ChangedElementsList)
    prompt = ChatPromptTemplate.from_messages([("system", DIFF_SYSTEM_PROMPT), ("user", DIFF_USER_PROMPT)])
    chain = prompt | structured_llm

    try:
        result: ChangedElementsList = chain.invoke({"pr_diff_text": pr_diff_text})
        return [element.model_dump() for element in result.elements]
    except Exception as e:
        logger.error("Error during diff element extraction: %s", e)
        raise


# -- Test file fetcher (Helper 2) --

def fetch_test_files(repo_name: str, branch_or_sha: str = "main") -> list[dict]:
    # Retrieve repo file tree via PyGitHub, filter for test files, and return path+content
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN not found in environment variables or .env file.")

    auth = Auth.Token(token)
    g = Github(auth=auth)

    try:
        repo = g.get_repo(repo_name)
    except GithubException as e:
        raise ValueError(f"Cannot access repository '{repo_name}': {e.data.get('message', str(e))}")

    try:
        git_tree = repo.get_git_tree(branch_or_sha, recursive=True)
    except Exception:
        logger.warning("Branch '%s' not found. Falling back to default branch.", branch_or_sha)
        git_tree = repo.get_git_tree(repo.default_branch, recursive=True)

    test_files: list[dict] = []
    for item in git_tree.tree:
        if item.type != "blob":
            continue
        path_lower = item.path.lower()
        filename = os.path.basename(item.path).lower()
        if "test_" in filename or "_test" in filename or "spec" in filename or "test_" in path_lower or "_test" in path_lower or "spec" in path_lower:
            try:
                content_file = repo.get_contents(item.path, ref=branch_or_sha)
                test_files.append({
                    "path": item.path,
                    "content": content_file.decoded_content.decode("utf-8"),
                })
            except Exception as e:
                logger.warning("Failed to fetch/decode test file '%s': %s", item.path, e)

    return test_files


# -- Test gap comparison logic (Helper 3) --

COMPARE_SYSTEM_PROMPT = (
    "You are a strict automated software QA and unit test reviewer. "
    "Compare a list of newly modified or added functions/classes against the existing test files, "
    "and identify which modifications lack test coverage. "
    "For each untested element, specify the file name and a brief note on missing coverage. "
    "Return output strictly conforming to the requested schema. Return an empty list if all are covered."
)

COMPARE_USER_PROMPT = (
    "Here is the list of newly added or modified functions/classes:\n{modified_elements}\n\n"
    "Here is the raw content of all existing unit test files in the repository:\n{test_files_context}\n\n"
    "Analyze and identify all missing tests. Return strictly as a structured list of test gaps."
)


def compare_and_find_test_gaps(modified_elements: list[dict], test_files: list[dict]) -> list[dict]:
    # Compare modified elements against test files using the LLM
    if not modified_elements:
        return []

    gemini_key = os.getenv("GEMINI_API_KEY")
    if not (gemini_key and _HAS_GEMINI):
        raise ValueError("GEMINI_API_KEY or langchain-google-genai is not configured.")

    logger.info("Initialising Gemini for test gap comparison...")
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=gemini_key, temperature=0.0)
    structured_llm = llm.with_structured_output(TestGapsList)
    prompt = ChatPromptTemplate.from_messages([("system", COMPARE_SYSTEM_PROMPT), ("user", COMPARE_USER_PROMPT)])
    chain = prompt | structured_llm

    if not test_files:
        test_files_context = "[No existing test files found in the repository]"
    else:
        test_files_context = "\n\n".join(f"=== File: {tf['path']} ===\n{tf['content']}" for tf in test_files)

    try:
        result: TestGapsList = chain.invoke({
            "modified_elements": json.dumps(modified_elements, indent=2),
            "test_files_context": test_files_context,
        })
        return [gap.model_dump() for gap in result.gaps]
    except Exception as e:
        logger.error("Error during test gap comparison: %s", e)
        raise


# -- LangGraph node function --

def run_test_gap_agent(state: dict) -> dict:
    # Extract PR info from state, find modified elements, fetch test files, identify gaps
    diff_text = state.get("pr_diff_text") or state.get("current_diff") or ""
    repo_name = state.get("repo_name")

    if not repo_name:
        logger.warning("No 'repo_name' in state. Skipping test gap analysis.")
        return {"test_gaps": []}

    if not diff_text.strip():
        logger.warning("PR diff text is empty. Returning empty findings.")
        return {"test_gaps": []}

    # 1. Extract modified functions/classes from the diff
    logger.info("Analysing diff to find modified classes/functions...")
    modified_elements = analyze_diff_elements(diff_text)
    if not modified_elements:
        logger.info("No modified functions or classes extracted.")
        return {"test_gaps": []}

    # 2. Fetch existing test files from the repository
    logger.info("Fetching existing test files for '%s'...", repo_name)
    try:
        test_files = fetch_test_files(repo_name)
    except Exception as e:
        logger.error("Failed to fetch test files: %s", e)
        test_files = []

    # 3. Compare and find gaps
    logger.info("Checking %d elements against %d test files...", len(modified_elements), len(test_files))
    test_gaps = compare_and_find_test_gaps(modified_elements, test_files)

    logger.info("Test gap analysis completed. Found %d gaps.", len(test_gaps))
    return {"test_gaps": test_gaps}


# -- Local test block --

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    mock_diff = (
        "diff --git a/backend/main.py b/backend/main.py\n"
        "index e69de29..867cf32 100644\n"
        "--- a/backend/main.py\n"
        "+++ b/backend/main.py\n"
        "@@ -1,3 +1,11 @@\n"
        "+def fetch_pr_data(repo_name: str, pr_number: int):\n"
        '+    return "mocked_data"\n'
        "+\n"
        "+def calculate_total_coverage(files: list) -> float:\n"
        "+    return 100.0\n"
    )

    test_state = {
        "repo_name": "yashpitrod/Agentic_AI",
        "pr_diff_text": mock_diff,
    }

    try:
        output = run_test_gap_agent(test_state)
        print(json.dumps(output, indent=2))
    except Exception as err:
        print(f"Error: {err}")
