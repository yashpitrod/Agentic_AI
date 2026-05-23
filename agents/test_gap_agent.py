from __future__ import annotations

import os
import sys
from pydantic import BaseModel, Field
from github import Github, Auth, GithubException
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv

# Load credentials from .env
load_dotenv()

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    _HAS_GEMINI = True
except ImportError:
    _HAS_GEMINI = False


# --- SECTION 1: PYDANTIC SCHEMAS FOR STRUCTURED OUTPUT ---

class ChangedElement(BaseModel):
    name: str = Field(
        ..., 
        description="The name of the newly added or modified function, method, or class."
    )
    file: str = Field(
        ..., 
        description="The filepath where this function or class is defined."
    )
    is_new: bool = Field(
        ..., 
        description="True if this function/class was newly added; False if it was modified."
    )

class ChangedElementsList(BaseModel):
    elements: list[ChangedElement] = Field(
        default=[], 
        description="List of all functions and classes that were added or modified in the pull request."
    )

class TestGap(BaseModel):
    function: str = Field(
        ..., 
        description="Name of the function or class that lacks corresponding test coverage."
    )
    file: str = Field(
        ..., 
        description="The filepath where this function or class is defined."
    )
    missing_test: str = Field(
        ..., 
        description="A brief description of what is missing in terms of test cases (e.g. success path, error handling, edge cases)."
    )

class TestGapsList(BaseModel):
    gaps: list[TestGap] = Field(
        default=[], 
        description="List of all detected gaps in test coverage for the pull request."
    )


# --- SECTION 2: DIFF ELEMENT EXTRACTION (Helper 1) ---

DIFF_SYSTEM_PROMPT = """You are a precise developer assistant specializing in parsing git diffs.
Your task is to analyze the provided Pull Request Diff and extract a list of all newly added or modified functions, methods, and classes.

You must ignore unrelated changes and return the output strictly conforming to the requested schema. Return an empty list if no functions or classes were added or modified.
"""

DIFF_USER_PROMPT = """Analyze this raw Pull Request Diff and extract all new or modified functions, methods, and classes:

{pr_diff_text}
"""

def analyze_diff_elements(pr_diff_text: str) -> list[dict]:
    """
    Takes the raw pull request diff, passes it to Gemini,
    and returns a structured JSON array representing all new or modified functions and classes.
    """
    if not pr_diff_text.strip():
        return []

    gemini_key = os.getenv("GEMINI_API_KEY")

    if gemini_key and _HAS_GEMINI:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", 
            google_api_key=gemini_key, 
            temperature=0.0
        )
    else:
        raise ValueError(
            "GEMINI_API_KEY or langchain-google-genai is not configured. "
            "This project uses Gemini for test gap analysis."
        )

    structured_llm = llm.with_structured_output(ChangedElementsList)

    prompt = ChatPromptTemplate.from_messages([
        ("system", DIFF_SYSTEM_PROMPT),
        ("user", DIFF_USER_PROMPT)
    ])
    
    chain = prompt | structured_llm

    try:
        result: ChangedElementsList = chain.invoke({
            "pr_diff_text": pr_diff_text
        })
        return [element.model_dump() for element in result.elements]
    except Exception as e:
        print(f"[Test Gap Agent] Error during diff element extraction: {e}")
        raise


# --- SECTION 3: TEST FILE FETCHER (Helper 2) ---

def fetch_test_files(repo_name: str, branch_or_sha: str = "main") -> list[dict]:
    """
    Queries PyGitHub to retrieve the repository file tree recursively.
    Filters and returns the file path and content of all files containing 
    'test_', '_test', or 'spec' in their path or name.
    """
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN not found in environment variables or .env file.")

    auth = Auth.Token(token)
    g = Github(auth=auth)

    try:
        repo = g.get_repo(repo_name)
    except GithubException as e:
        raise ValueError(f"Could not find or access repository '{repo_name}': {e.data.get('message', str(e))}")

    try:
        git_tree = repo.get_git_tree(branch_or_sha, recursive=True)
    except Exception:
        print(f"[Test Gap Agent] Branch '{branch_or_sha}' not found. Falling back to default branch.")
        git_tree = repo.get_git_tree(repo.default_branch, recursive=True)

    test_files: list[dict] = []
    
    for item in git_tree.tree:
        if item.type == "blob":
            path = item.path
            path_lower = path.lower()
            filename = os.path.basename(path).lower()

            if "test_" in filename or "_test" in filename or "spec" in filename or "test_" in path_lower or "_test" in path_lower or "spec" in path_lower:
                try:
                    content_file = repo.get_contents(path, ref=branch_or_sha)
                    decoded_content = content_file.decoded_content.decode("utf-8")
                    test_files.append({
                        "path": path,
                        "content": decoded_content
                    })
                except Exception as e:
                    print(f"Warning: Failed to fetch/decode test file '{path}': {e}")

    return test_files


# --- SECTION 4: TEST GAP COMPARISON LOGIC (New Helper) ---

COMPARE_SYSTEM_PROMPT = """You are a strict automated software QA and unit test reviewer.
Your objective is to compare a list of newly modified or added functions/classes against the existing test files in the codebase, and identify which of those modifications lack test coverage.

For each function or class with NO corresponding unit tests, you must specify the file name and provide a brief note on the missing test coverage or relevant test scenarios (e.g. success path, failure cases, edge inputs).

You must return your output strictly conforming to the requested schema. Return an empty list if all modified elements are covered by tests.
"""

COMPARE_USER_PROMPT = """Here is the list of newly added or modified functions/classes:
{modified_elements}

Here is the raw content of all existing unit test files in the repository:
{test_files_context}

Please analyze these inputs and identify all missing tests. Return strictly as a structured list of test gaps.
"""

def compare_and_find_test_gaps(modified_elements: list[dict], test_files: list[dict]) -> list[dict]:
    """
    Compares modified functions/classes against existing test files using the LLM.
    Identifies which functions have no tests, and returns a structured JSON array.
    """
    if not modified_elements:
        return []

    gemini_key = os.getenv("GEMINI_API_KEY")

    if gemini_key and _HAS_GEMINI:
        print("[Test Gap Agent] Initializing Gemini for test gap comparison...")
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", 
            google_api_key=gemini_key, 
            temperature=0.0
        )
    else:
        raise ValueError("GEMINI_API_KEY or langchain-google-genai is not configured.")

    structured_llm = llm.with_structured_output(TestGapsList)

    prompt = ChatPromptTemplate.from_messages([
        ("system", COMPARE_SYSTEM_PROMPT),
        ("user", COMPARE_USER_PROMPT)
    ])
    
    chain = prompt | structured_llm

    # Compile the test files text into a single readable block
    if not test_files:
        test_files_context = "[No existing test files found in the repository]"
    else:
        formatted_files = []
        for tf in test_files:
            formatted_files.append(f"=== File: {tf['path']} ===\n{tf['content']}")
        test_files_context = "\n\n".join(formatted_files)

    import json
    try:
        result: TestGapsList = chain.invoke({
            "modified_elements": json.dumps(modified_elements, indent=2),
            "test_files_context": test_files_context
        })
        return [gap.model_dump() for gap in result.gaps]
    except Exception as e:
        print(f"[Test Gap Agent] Error during comparison logic: {e}")
        raise


# --- SECTION 5: LANGGRAPH NODE FUNCTION ---

def run_test_gap_agent(state: dict) -> dict:
    """
    LangGraph node function that extracts PR details from state,
    retrieves modified elements and repository test files, identifies test gaps,
    and returns them under the state update key 'test_gaps'.
    
    Args:
        state (dict): State dictionary containing 'pr_diff_text' (or 'current_diff') and 'repo_name'.
        
    Returns:
        dict: State update dictionary containing {"test_gaps": <list_of_gaps>}
    """
    diff_text = state.get("pr_diff_text") or state.get("current_diff") or ""
    repo_name = state.get("repo_name")

    if not repo_name:
        print("[Test Gap Node] No 'repo_name' found in state. Skipping execution.")
        return {"test_gaps": []}

    if not diff_text.strip():
        print("[Test Gap Node] PR diff text is empty. Returning empty findings.")
        return {"test_gaps": []}

    # 1. Extract newly added or modified functions/classes from the PR diff
    print("[Test Gap Node] Analyzing diff to find modified classes/functions...")
    modified_elements = analyze_diff_elements(diff_text)
    
    if not modified_elements:
        print("[Test Gap Node] No modified functions or classes extracted. Returning empty findings.")
        return {"test_gaps": []}

    # 2. Fetch all unit test files in the repository
    print(f"[Test Gap Node] Fetching existing test files for '{repo_name}'...")
    try:
        test_files = fetch_test_files(repo_name)
    except Exception as e:
        print(f"[Test Gap Node] Failed to fetch test files: {e}")
        test_files = []

    # 3. Perform comparison to find test gaps
    print(f"[Test Gap Node] Checking {len(modified_elements)} functions/classes against {len(test_files)} test files...")
    test_gaps = compare_and_find_test_gaps(modified_elements, test_files)

    print(f"[Test Gap Node] Analysis completed. Identified {len(test_gaps)} test gaps.")
    return {"test_gaps": test_gaps}


# --- SECTION 6: LOCAL RUNNABLE TEST BLOCK ---

if __name__ == "__main__":
    print("Testing Test Gap Agent Node completely independently...")

    # Mock diff containing one function that is already tested and one that is completely untested
    mock_diff = """
diff --git a/backend/main.py b/backend/main.py
index e69de29..867cf32 100644
--- a/backend/main.py
+++ b/backend/main.py
@@ -1,3 +1,11 @@
+def fetch_pr_data(repo_name: str, pr_number: int):
+    # Note: Historically fetch_pr_data is standard in our project
+    return "mocked_data"
+
+def calculate_total_coverage(files: list) -> float:
+    # Note: Newly introduced utility function, lacks any test coverage!
+    return 100.0
"""

    # Mock test files in the repo (one tests fetch_pr_data, but neither tests calculate_total_coverage)
    mock_test_files = [
        {
            "path": "tests/test_fetcher.py",
            "content": """
import pytest
from backend.github_fetcher import fetch_pr_data

def test_fetch_pr_data_success():
    data = fetch_pr_data("owner/repo", 1)
    assert data is not None
"""
        }
    ]

    print("\n1. Testing raw compare helper with dummy test files:")
    modified_list = [
        {"name": "fetch_pr_data", "file": "backend/main.py", "is_new": True},
        {"name": "calculate_total_coverage", "file": "backend/main.py", "is_new": True}
    ]
    
    gaps = compare_and_find_test_gaps(modified_list, mock_test_files)
    
    import json
    print("\n=== RAW COMPARE RESULTS ===")
    print(json.dumps(gaps, indent=2))

    print("\n" + "="*50)
    print("2. Testing full LangGraph node function (State flow):")
    
    test_state = {
        "repo_name": "yashpitrod/Agentic_AI",
        "pr_diff_text": mock_diff
    }
    
    try:
        output = run_test_gap_agent(test_state)
        print("\n=== LANGGRAPH NODE OUTPUT STATE ===")
        print(json.dumps(output, indent=2))
    except Exception as err:
        print(f"Error executing LangGraph node test: {err}")
