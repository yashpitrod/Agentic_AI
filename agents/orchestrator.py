from __future__ import annotations

import asyncio
from typing import TypedDict
from langgraph.graph import StateGraph, START, END

from agents.architecture_agent import run_architecture_agent
from agents.security_agent import run_security_agent

# --- SECTION 1: LANGGRAPH ORCHESTRATION SKELETON (Phase 1 Setup) ---

# Shared state contract for all review agents.
class GraphState(TypedDict):
    diff: str
    repo: str | None
    pr_number: int | None
    context_findings: list[dict]
    security_findings: list[dict]
    architecture_findings: list[dict]


async def context_node(state: GraphState) -> GraphState:
    return {
        **state,
        "context_findings": await context_agent(state["diff"], repo=state.get("repo")),
    }


async def security_node(state: GraphState) -> GraphState:
    return {
        **state,
        "security_findings": await run_security_agent(state["diff"]),
    }


async def architecture_node(state: GraphState) -> GraphState:
    return {
        **state,
        "architecture_findings": await run_architecture_agent(state["diff"]),
    }

# Initialize StateGraph
workflow = StateGraph(GraphState)

# Add one node per shared finding bucket.
workflow.add_node("context_node", context_node)
workflow.add_node("security_node", security_node)
workflow.add_node("architecture_node", architecture_node)

# Run the review buckets in a simple sequence for now.
workflow.add_edge("context_node", "security_node")
workflow.add_edge("security_node", "architecture_node")

# Setup START and END edges
workflow.add_edge(START, "context_node")
workflow.add_edge("architecture_node", END)

# Compile the graph
app = workflow.compile()


# --- SECTION 2: ASYNC PR REVIEW AGENT LOGIC ---


def _has_any(text: str, needles: list[str]) -> bool:
    lowered = text.lower()
    return any(needle in lowered for needle in needles)


async def test_gap_agent(diff: str) -> list[dict]:
    changed_code = _has_any(diff, [".py", "def ", "class ", "async def "])
    changed_tests = _has_any(diff, ["test_", "tests/", "pytest", "unittest"])

    if changed_code and not changed_tests:
        return [
            {
                "type": "test_gap",
                "severity": "warning",
                "description": "Code changed without obvious test changes in the diff.",
            }
        ]
    return []


async def context_agent(diff: str, repo: str | None = None) -> list[dict]:
    if not repo:
        return [
            {
                "type": "repo_context",
                "severity": "info",
                "description": "Repo context not available yet. Historical PR consistency checks can be added after GitHub API wiring.",
            }
        ]
    return []


async def review_diff(diff: str, repo: str | None = None, pr_number: int | None = None) -> dict:
    context_findings = await context_agent(diff, repo=repo)
    security_findings = await run_security_agent(diff)
    architecture_findings = await run_architecture_agent(diff)
    state: GraphState = {
        "diff": diff,
        "repo": repo,
        "pr_number": pr_number,
        "context_findings": context_findings,
        "security_findings": security_findings,
        "architecture_findings": architecture_findings,
    }
    findings = flatten_findings(state)

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    findings.sort(key=lambda finding: severity_order.get(finding["severity"], 99))

    return {
        "repo": repo,
        "pr_number": pr_number,
        "state": state,
        "summary": {
            "finding_count": len(findings),
            "highest_severity": findings[0]["severity"] if findings else "none",
        },
        "findings": findings,
        "markdown": format_review_markdown(findings),
    }


def flatten_findings(state: GraphState) -> list[dict]:
    findings: list[dict] = []

    for item in state["security_findings"]:
        findings.append(
            {
                "agent": "Security Agent",
                "severity": item.get("severity", "warning"),
                "title": item.get("issue_type", "Security issue"),
                "details": item.get("description", ""),
                "file": item.get("file", ""),
                "line_hint": item.get("line_hint", ""),
            }
        )

    for item in state["architecture_findings"]:
        findings.append(
            {
                "agent": "Architecture Agent",
                "severity": item.get("severity", "warning"),
                "title": item.get("violation_type", "Architecture violation"),
                "details": item.get("description", ""),
                "refactor_suggestion": item.get("refactor_suggestion", ""),
            }
        )

    for item in state["context_findings"]:
        findings.append(
            {
                "agent": "Context Agent",
                "severity": item.get("severity", "info"),
                "title": item.get("type", "Context finding"),
                "details": item.get("description", ""),
            }
        )

    return findings


def format_review_markdown(findings: list[dict]) -> str:
    if not findings:
        return "## SilentReviewer\n\nNo blocking issues found in this first-pass review."

    lines = ["## SilentReviewer", "", "| Severity | Agent | Finding |", "| --- | --- | --- |"]
    for finding in findings:
        lines.append(
            f"| {finding['severity'].upper()} | {finding['agent']} | {finding['title']}: {finding['details']} |"
        )
    return "\n".join(lines)


# --- SECTION 3: LOCAL SKELETON EXECUTION TEST ---

if __name__ == "__main__":
    print("LangGraph & LangChain Google GenAI imports successful!")
    print("Executing LangGraph skeleton skeleton locally...")
    
    # Run/invoke the graph with the agreed state keys.
    initial_state: GraphState = {
        "diff": "",
        "repo": None,
        "pr_number": None,
        "context_findings": [],
        "security_findings": [],
        "architecture_findings": [],
    }
    result = asyncio.run(app.ainvoke(initial_state))
    
    print(f"Final State result: {result}")
