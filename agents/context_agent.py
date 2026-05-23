from __future__ import annotations

import os
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate

# Support both Gemini and Claude so the user has maximum flexibility
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    _HAS_GEMINI = True
except ImportError:
    _HAS_GEMINI = False

try:
    from langchain_anthropic import ChatAnthropic
    _HAS_CLAUDE = True
except ImportError:
    _HAS_CLAUDE = False

from backend.history_fetcher import get_historical_codebase_structure

# --- SECTION 1: PYDANTIC SCHEMAS FOR STRUCTURED OUTPUT ---

class ContextFinding(BaseModel):
    issue: str = Field(
        ..., 
        description="Detailed description of the naming convention, error handling, or structural inconsistency found."
    )
    severity: str = Field(
        ..., 
        description="Severity of the issue. Must be either 'warning' or 'info'."
    )
    location: str = Field(
        ..., 
        description="Location of the issue (e.g., function name, class name, or line number)."
    )

class ContextFindingsList(BaseModel):
    findings: list[ContextFinding] = Field(
        default=[], 
        description="A list of architectural or stylistic findings."
    )

# --- SECTION 2: SYSTEM AND USER PROMPT DEFINITION ---

SYSTEM_PROMPT = """You are a strict automated software architecture and code style reviewer.
Your objective is to review a new incoming Pull Request Diff by comparing it to the historical patterns of the codebase to identify stylistic, naming, or architectural inconsistencies.

HISTORICAL CODEBASE STRUCTURE:
{historical_structure}
"""

USER_PROMPT = """CURRENT PR DIFF:
{current_diff}

Instructions:
1. **Naming Conventions**: Identify new functions, classes, variables, or files that violate the established naming patterns seen in the historical codebase structure.
2. **Error Handling & Architecture**: Note if the PR introduces error handling patterns, libraries, or imports that deviate from established historical practices.
3. **Third-Party Imports**: Flag if the PR introduces unexpected packages that aren't historically present or organized.
4. **General Structure**: Identify deviations in architecture or module layout.

Analyze the diff carefully. You must structure your output strictly as a JSON array of findings using the provided schema. If no inconsistencies are found, return an empty array.
"""

# --- SECTION 3: LANGGRAPH NODE FUNCTION ---

def run_context_agent(state: dict) -> dict:
    """
    LangGraph node function that extracts PR info from state, fetches repository
    history patterns, runs a code consistency check using the LLM,
    and returns context findings.
    
    Args:
        state (dict): State dictionary containing 'repo_name' and 'current_diff'
        
    Returns:
        dict: State update dictionary containing {"context_findings": <list_of_findings>}
    """
    repo_name = state.get("repo_name")
    current_diff = state.get("current_diff", "")

    if not repo_name:
        print("[Context Agent] No 'repo_name' found in state. Skipping execution.")
        return {"context_findings": []}
    
    if not current_diff:
        print("[Context Agent] No 'current_diff' found in state. Returning empty findings.")
        return {"context_findings": []}

    # 1. Fetch the compiled historical codebase structure
    try:
        historical_structure = get_historical_codebase_structure(repo_name, limit=15)
    except Exception as e:
        print(f"[Context Agent] Error fetching repository history: {e}")
        historical_structure = "Error: Historical codebase structure could not be retrieved."

    # 2. Select and initialize the validated LLM (prefers Gemini as verified, falls back to Anthropic)
    gemini_key = os.getenv("GEMINI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")

    if gemini_key and _HAS_GEMINI:
        print(f"[Context Agent] Initializing Gemini model for code consistency analysis...")
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash", 
            google_api_key=gemini_key, 
            temperature=0.1
        )
    elif anthropic_key and _HAS_CLAUDE:
        print(f"[Context Agent] Initializing Claude model for code consistency analysis...")
        llm = ChatAnthropic(
            model="claude-3-5-sonnet-latest", 
            anthropic_api_key=anthropic_key, 
            temperature=0.1
        )
    else:
        raise ValueError(
            "No active API keys or compatible LLM integration libraries found. "
            "Please ensure either GEMINI_API_KEY or ANTHROPIC_API_KEY is configured in your .env file."
        )

    # 3. Request Structured Output matching our schema
    structured_llm = llm.with_structured_output(ContextFindingsList)

    # 4. Generate structured findings using system and user prompt format (required for Gemini compatibility)
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("user", USER_PROMPT)
    ])
    
    chain = prompt | structured_llm

    try:
        result: ContextFindingsList = chain.invoke({
            "historical_structure": historical_structure,
            "current_diff": current_diff
        })
        
        # Serialize Pydantic findings list to the requested [{ "issue": "...", ... }] JSON array format
        findings_json_array = [finding.model_dump() for finding in result.findings]
        
    except Exception as e:
        print(f"[Context Agent] LLM invocation failed: {e}")
        findings_json_array = [{
            "issue": f"Failed to run code consistency checks: {str(e)}",
            "severity": "info",
            "location": "system"
        }]

    print(f"[Context Agent] Completed review. Found {len(findings_json_array)} stylistic/architectural issues.")
    return {"context_findings": findings_json_array}

# --- SECTION 4: LOCAL RUNNABLE TEST BLOCK ---

if __name__ == "__main__":
    # Test script locally with dummy diff to verify the agent works
    print("Testing Context Agent locally...")
    
    test_state = {
        "repo_name": "yashpitrod/Agentic_AI",
        "current_diff": """
diff --git a/backend/routes.py b/backend/routes.py
index e69de29..867cf32 100644
--- a/backend/routes.py
+++ b/backend/routes.py
@@ -1,3 +1,11 @@
+def fetchReviewResult(diffText, prNum):
+    # Violates standard snake_case naming style and has no error handling
+    import urllib.request
+    response = urllib.request.urlopen(f"https://api.github.com/repos/yashpitrod/Agentic_AI/pulls/{prNum}")
+    return response.read()
"""
    }
    
    try:
        output = run_context_agent(test_state)
        print("\n=== AGENT FINDINGS ARRAY ===")
        import json
        print(json.dumps(output, indent=2))
    except Exception as err:
        print(f"Error executing agent test: {err}")
