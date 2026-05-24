from __future__ import annotations

import logging
import os

from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    _HAS_GEMINI = True
except ImportError:
    _HAS_GEMINI = False

from backend.history_fetcher import get_historical_codebase_structure

logger = logging.getLogger(__name__)


# -- Pydantic schemas for structured LLM output --

class ContextFinding(BaseModel):
    issue: str = Field(..., description="Description of the naming/error-handling/structural inconsistency.")
    severity: str = Field(..., description="Severity: 'warning' or 'info'.")
    location: str = Field(..., description="Location of the issue (function, class, or line).")


class ContextFindingsList(BaseModel):
    findings: list[ContextFinding] = Field(default=[], description="List of stylistic/architectural findings.")


# -- Prompt definitions --

SYSTEM_PROMPT = (
    "You are a strict automated software architecture and code style reviewer. "
    "Review a new incoming Pull Request Diff by comparing it to the historical patterns "
    "of the codebase to identify stylistic, naming, or architectural inconsistencies.\n\n"
    "If the historical structure is unavailable, empty, or errored, perform a rigorous fallback review of the PR "
    "against standard modern industry conventions (e.g., PEP 8 for Python, standard casing, error handling hygiene, "
    "and clean code principles).\n\n"
    "HISTORICAL CODEBASE STRUCTURE:\n{historical_structure}"
)

USER_PROMPT = (
    "CURRENT PR DIFF:\n{current_diff}\n\n"
    "Instructions:\n"
    "1. Naming Conventions: Identify functions/classes/variables/files that violate established casing or naming patterns (like camelCase vs snake_case, short variable names, inconsistent names).\n"
    "2. Error Handling & Architecture: Devise strict reviews against robust error handling, raw exceptions, and missing try-except blocks in the diff.\n"
    "3. Third-Party Imports: Flag unexpected package imports or unusual module additions.\n"
    "4. General Structure: Identify general clean code violations, duplicated logic, or poorly structured modules in the diff.\n\n"
    "Return a JSON array of findings using the provided schema. If none are found, return an empty array."
)


# -- LangGraph node function --

async def run_context_agent(state: dict) -> dict:
    # Fetch historical patterns and run consistency check via Gemini
    repo_name = state.get("repo_name")
    current_diff = state.get("current_diff", "")

    if not repo_name:
        logger.warning("No 'repo_name' in state. Skipping context analysis.")
        return {"context_findings": []}

    if not current_diff:
        logger.warning("No 'current_diff' in state. Returning empty findings.")
        return {"context_findings": []}

    # 1. Fetch compiled historical codebase structure (now async)
    try:
        historical_structure = await get_historical_codebase_structure(repo_name, limit=15)
    except Exception as e:
        logger.error("Error fetching repository history: %s", e)
        historical_structure = "Error: Historical codebase structure could not be retrieved."

    # 2. Initialise Gemini
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not (gemini_key and _HAS_GEMINI):
        raise ValueError("GEMINI_API_KEY or langchain-google-genai is not configured.")

    logger.info("Initialising Gemini for code consistency analysis...")
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=gemini_key, temperature=0.1)
    structured_llm = llm.with_structured_output(ContextFindingsList)

    # 3. Build prompt chain and invoke
    prompt = ChatPromptTemplate.from_messages([("system", SYSTEM_PROMPT), ("user", USER_PROMPT)])
    chain = prompt | structured_llm

    try:
        result: ContextFindingsList = chain.invoke({
            "historical_structure": historical_structure,
            "current_diff": current_diff,
        })
        findings_json_array = [finding.model_dump() for finding in result.findings]
    except Exception as e:
        logger.error("LLM invocation failed: %s", e)
        raise

    logger.info("Context analysis completed. Found %d issues.", len(findings_json_array))
    return {"context_findings": findings_json_array}


# -- Local test block --

if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)

    test_state = {
        "repo_name": "yashpitrod/Agentic_AI",
        "current_diff": (
            "diff --git a/backend/routes.py b/backend/routes.py\n"
            "+def fetchReviewResult(diffText, prNum):\n"
            "+    import urllib.request\n"
            "+    response = urllib.request.urlopen(f'https://api.github.com/repos/...')\n"
            "+    return response.read()\n"
        ),
    }

    async def _main():
        import json
        output = await run_context_agent(test_state)
        print(json.dumps(output, indent=2))

    asyncio.run(_main())
