from __future__ import annotations

import asyncio
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from agents.architecture_agent import run_architecture_agent
from agents.context_agent import run_context_agent
from agents.security_agent import run_security_agent
from agents.synthesis_agent import synthesize_findings
from agents.test_gap_agent import run_test_gap_agent
from backend.schemas import PRData


class ReviewState(TypedDict, total=False):
    pr_data: PRData
    repo_name: str
    pr_number: int
    current_diff: str
    security_findings: list[dict]
    architecture_findings: list[dict]
    test_gaps: list[dict]
    consistency: list[dict]
    context_findings: list[dict]
    final_review: dict


def prepare_pr_state(state: ReviewState) -> ReviewState:
    pr_data = state["pr_data"]
    return {
        **state,
        "repo_name": pr_data.repo_name,
        "pr_number": pr_data.pr_number,
        "current_diff": pr_data.diff_text,
        "security_findings": [],
        "architecture_findings": [],
        "test_gaps": [],
        "consistency": [],
        "context_findings": [],
    }


def fan_out_agents(state: ReviewState) -> list[Send]:
    return [
        Send("security_agent", state),
        Send("architecture_agent", state),
        Send("test_gap_agent", state),
        Send("consistency_agent", state),
    ]


async def security_node(state: ReviewState) -> ReviewState:
    return {
        "security_findings": await run_security_agent(state["current_diff"]),
    }


async def architecture_node(state: ReviewState) -> ReviewState:
    return {
        "architecture_findings": await run_architecture_agent(state["current_diff"]),
    }


async def test_gap_node(state: ReviewState) -> ReviewState:
    try:
        result = await asyncio.to_thread(
            run_test_gap_agent,
            {
                "repo_name": state["repo_name"],
                "current_diff": state["current_diff"],
                "pr_diff_text": state["current_diff"],
            },
        )
        return {"test_gaps": result.get("test_gaps", [])}
    except Exception as exc:
        return {
            "test_gaps": [
                {
                    "function": "system",
                    "file": "",
                    "missing_test": f"Test Gap Agent failed: {exc}",
                    "severity": "info",
                }
            ]
        }


async def consistency_node(state: ReviewState) -> ReviewState:
    try:
        result = await asyncio.to_thread(
            run_context_agent,
            {
                "repo_name": state["repo_name"],
                "current_diff": state["current_diff"],
            },
        )
        findings = result.get("context_findings", [])
        return {
            "context_findings": findings,
            "consistency": findings,
        }
    except Exception as exc:
        findings = [
            {
                "issue": f"Consistency Agent failed: {exc}",
                "severity": "info",
                "location": "system",
            }
        ]
        return {
            "context_findings": findings,
            "consistency": findings,
        }


async def synthesis_node(state: ReviewState) -> ReviewState:
    final_review = await synthesize_findings(
        security=state.get("security_findings", []),
        architecture=state.get("architecture_findings", []),
        test_gaps=state.get("test_gaps", []),
        consistency=state.get("consistency", []),
    )
    return {"final_review": final_review}


workflow = StateGraph(ReviewState)
workflow.add_node("prepare_pr_state", prepare_pr_state)
workflow.add_node("orchestrate_agents", lambda state: state)
workflow.add_node("security_agent", security_node)
workflow.add_node("architecture_agent", architecture_node)
workflow.add_node("test_gap_agent", test_gap_node)
workflow.add_node("consistency_agent", consistency_node)
workflow.add_node("synthesis", synthesis_node)

workflow.add_edge(START, "prepare_pr_state")
workflow.add_edge("prepare_pr_state", "orchestrate_agents")
workflow.add_conditional_edges("orchestrate_agents", fan_out_agents)
workflow.add_edge("security_agent", "synthesis")
workflow.add_edge("architecture_agent", "synthesis")
workflow.add_edge("test_gap_agent", "synthesis")
workflow.add_edge("consistency_agent", "synthesis")
workflow.add_edge("synthesis", END)

review_graph = workflow.compile()


async def review_pr_data(pr_data: PRData) -> dict:
    state = await review_graph.ainvoke({"pr_data": pr_data})
    final_review = state["final_review"]
    return {
        "repo": pr_data.repo_name,
        "pr_number": pr_data.pr_number,
        "pr_title": pr_data.pr_title,
        "author": pr_data.author,
        "state": {
            "security_findings": state.get("security_findings", []),
            "architecture_findings": state.get("architecture_findings", []),
            "test_gaps": state.get("test_gaps", []),
            "consistency": state.get("consistency", []),
            "context_findings": state.get("context_findings", []),
        },
        "final_review": final_review,
        "markdown": format_review_markdown(final_review),
    }


async def review_diff(diff: str, repo: str | None = None, pr_number: int | None = None) -> dict:
    pr_data = PRData(
        repo_name=repo or "manual/demo",
        pr_number=pr_number or 0,
        diff_text=diff,
        pr_title="Manual diff review",
        author="manual",
    )
    return await review_pr_data(pr_data)


def format_review_markdown(final_review: dict) -> str:
    lines = [
        "## SilentReviewer",
        "",
        final_review.get("summary_text", ""),
        "",
        f"**Overall severity:** {final_review.get('overall_severity', 'none').upper()}",
        "",
        "### Security",
        *_format_items(final_review.get("security", [])),
        "",
        "### Architecture",
        *_format_items(final_review.get("architecture", [])),
        "",
        "### Test Gaps",
        *_format_items(final_review.get("test_gaps", [])),
        "",
        "### Consistency",
        *_format_items(final_review.get("consistency", [])),
    ]
    return "\n".join(lines)


def _format_items(items: list[dict]) -> list[str]:
    if not items:
        return ["- No findings."]
    return [f"- {item}" for item in items]


if __name__ == "__main__":
    demo = PRData(
        repo_name="demo/repo",
        pr_number=1,
        diff_text="+ password = \"admin123\"\n+ def send_email_and_save_user_to_db(user):\n+     pass",
        pr_title="Demo",
        author="local",
    )
    print(asyncio.run(review_pr_data(demo)))
