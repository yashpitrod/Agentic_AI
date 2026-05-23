from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TypedDict
import langgraph
import langchain_google_genai
from langgraph.graph import StateGraph, START, END

# --- SECTION 1: LANGGRAPH ORCHESTRATION SKELETON (Phase 1 Setup) ---

# Define a simple dummy state Dict
class GraphState(TypedDict):
    dummy_key: str

# Define nodes as requested
def start_node(state: GraphState) -> GraphState:
    print("Graph started")
    return {"dummy_key": "started"}

def end_node(state: GraphState) -> GraphState:
    print("Graph ended")
    return {"dummy_key": "ended"}

# Initialize StateGraph
workflow = StateGraph(GraphState)

# Add exactly two nodes
workflow.add_node("start_node", start_node)
workflow.add_node("end_node", end_node)

# Connect start_node to end_node with an edge
workflow.add_edge("start_node", "end_node")

# Setup START and END edges
workflow.add_edge(START, "start_node")
workflow.add_edge("end_node", END)

# Compile the graph
app = workflow.compile()


# --- SECTION 2: ASYNC PR REVIEW AGENT LOGIC (Partner's Logic) ---

@dataclass
class AgentFinding:
    agent: str
    severity: str
    title: str
    details: str


def _has_any(text: str, needles: list[str]) -> bool:
    lowered = text.lower()
    return any(needle in lowered for needle in needles)


async def security_scan_agent(diff: str) -> list[AgentFinding]:
    findings: list[AgentFinding] = []
    if _has_any(diff, ["password=", "api_key", "secret", "token=", "private_key"]):
        findings.append(
            AgentFinding(
                agent="Security Scan Agent",
                severity="high",
                title="Possible hardcoded secret",
                details="Diff contains secret-like keywords. Verify this is not a credential before merging.",
            )
        )
    if _has_any(diff, ["eval(", "exec(", "subprocess.", "shell=true"]):
        findings.append(
            AgentFinding(
                agent="Security Scan Agent",
                severity="medium",
                title="Potential command/code execution risk",
                details="Diff includes dynamic execution patterns. Validate inputs and avoid shell execution where possible.",
            )
        )
    return findings


async def architecture_review_agent(diff: str) -> list[AgentFinding]:
    findings: list[AgentFinding] = []
    added_lines = [line for line in diff.splitlines() if line.startswith("+") and not line.startswith("+++")]

    if len(added_lines) > 250:
        findings.append(
            AgentFinding(
                agent="Architecture Review Agent",
                severity="medium",
                title="Large PR surface area",
                details="This PR adds many lines. Consider splitting reviewable units if the changes mix concerns.",
            )
        )
    if _has_any(diff, ["todo", "fixme", "hack"]):
        findings.append(
            AgentFinding(
                agent="Architecture Review Agent",
                severity="low",
                title="Temporary implementation marker found",
                details="TODO/FIXME/HACK markers should either become tracked issues or be resolved before merge.",
            )
        )
    return findings


async def test_gap_agent(diff: str) -> list[AgentFinding]:
    changed_code = _has_any(diff, [".py", "def ", "class ", "async def "])
    changed_tests = _has_any(diff, ["test_", "tests/", "pytest", "unittest"])

    if changed_code and not changed_tests:
        return [
            AgentFinding(
                agent="Test Gap Detector",
                severity="medium",
                title="No obvious test updates",
                details="Code changed without test changes in the diff. Add coverage for success, failure, and edge paths.",
            )
        ]
    return []


async def context_agent(diff: str, repo: str | None = None) -> list[AgentFinding]:
    if not repo:
        return [
            AgentFinding(
                agent="Repo Context Agent",
                severity="info",
                title="Repo context not available yet",
                details="Phase 1 is using webhook/demo input only. Historical PR consistency checks can be added after GitHub API wiring.",
            )
        ]
    return []


async def review_diff(diff: str, repo: str | None = None, pr_number: int | None = None) -> dict:
    agent_results = await asyncio.gather(
        security_scan_agent(diff),
        architecture_review_agent(diff),
        test_gap_agent(diff),
        context_agent(diff, repo=repo),
    )
    findings = [finding for result in agent_results for finding in result]

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    findings.sort(key=lambda finding: severity_order.get(finding.severity, 99))

    return {
        "repo": repo,
        "pr_number": pr_number,
        "summary": {
            "finding_count": len(findings),
            "highest_severity": findings[0].severity if findings else "none",
        },
        "findings": [finding.__dict__ for finding in findings],
        "markdown": format_review_markdown(findings),
    }


def format_review_markdown(findings: list[AgentFinding]) -> str:
    if not findings:
        return "## SilentReviewer\n\nNo blocking issues found in this first-pass review."

    lines = ["## SilentReviewer", "", "| Severity | Agent | Finding |", "| --- | --- | --- |"]
    for finding in findings:
        lines.append(f"| {finding.severity.upper()} | {finding.agent} | {finding.title}: {finding.details} |")
    return "\n".join(lines)


# --- SECTION 3: LOCAL SKELETON EXECUTION TEST ---

if __name__ == "__main__":
    print("LangGraph & LangChain Google GenAI imports successful!")
    print("Executing LangGraph skeleton skeleton locally...")
    
    # Run/invoke the graph with an initial dummy state
    initial_state: GraphState = {"dummy_key": "init"}
    result = app.invoke(initial_state)
    
    print(f"Final State result: {result}")
