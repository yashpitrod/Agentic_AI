from __future__ import annotations

import asyncio
import logging
import operator
import os
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph

from agents.architecture_agent import run_architecture_agent
from agents.context_agent import run_context_agent
from agents.security_agent import run_security_agent
from agents.test_gap_agent import run_test_gap_agent
from agents.commenter_agent import format_markdown_review, post_github_comment
from backend.schemas import PRData

logger = logging.getLogger(__name__)


# -- State definition (TypedDict) --
class GraphState(TypedDict):
    pr_diff: str
    repo_name: str | None
    pr_number: int | None
    agent_results: Annotated[dict, operator.ior]
    agent_errors: Annotated[dict, operator.ior]
    synthesis_output: dict


# -- StateGraph nodes --

async def prepare_diff_node(state: GraphState) -> dict:
    # Reads the diff and prepares the shared state
    logger.info("Preparing PR review state...")
    return {
        "agent_results": {},
        "agent_errors": {},
        "synthesis_output": {},
    }


async def _run_with_retry(agent_name: str, call, attempts: int = 2, delay_seconds: float = 1.0):
    # Run one agent with a small retry budget; raise the last error if all attempts fail
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await call()
        except Exception as exc:
            last_error = exc
            logger.warning("%s attempt %d/%d failed: %s", agent_name, attempt, attempts, exc)
            if attempt < attempts:
                await asyncio.sleep(delay_seconds)
    raise last_error or RuntimeError(f"{agent_name} failed")


async def security_node(state: GraphState) -> dict:
    # Security Agent Node — executes security checks, skips gracefully on failure
    logger.info("Running Security Agent...")
    diff = state["pr_diff"]
    try:
        real_findings = await _run_with_retry(
            "Security Agent",
            lambda: run_security_agent(diff),
        )
        if real_findings and real_findings[0].get("issue_type") == "security_agent_error":
            raise RuntimeError(real_findings[0].get("description"))
        findings = real_findings
    except Exception as exc:
        logger.warning("Security Agent skipped after retries: %s", exc)
        return {
            "agent_results": {"security": []},
            "agent_errors": {"security": str(exc)},
        }

    return {
        "agent_results": {"security": findings},
        "agent_errors": {},
    }


async def architecture_node(state: GraphState) -> dict:
    # Architecture Agent Node — executes design checks, skips gracefully on failure
    logger.info("Running Architecture Agent...")
    diff = state["pr_diff"]
    try:
        real_findings = await _run_with_retry(
            "Architecture Agent",
            lambda: run_architecture_agent(diff),
        )
        if real_findings and real_findings[0].get("violation_type") == "architecture_agent_error":
            raise RuntimeError(real_findings[0].get("description"))
        findings = real_findings
    except Exception as exc:
        logger.warning("Architecture Agent skipped after retries: %s", exc)
        return {
            "agent_results": {"architecture": []},
            "agent_errors": {"architecture": str(exc)},
        }

    return {
        "agent_results": {"architecture": findings},
        "agent_errors": {},
    }


async def test_gap_node(state: GraphState) -> dict:
    # Test Gap Agent Node — analyses coverage gaps, skips gracefully on failure
    logger.info("Running Test Gap Agent...")
    try:
        real_result = await _run_with_retry(
            "Test Gap Agent",
            lambda: asyncio.to_thread(
                run_test_gap_agent,
                {
                    "repo_name": state.get("repo_name") or "demo/repo",
                    "current_diff": state["pr_diff"],
                    "pr_diff_text": state["pr_diff"],
                },
            ),
        )
        findings = real_result.get("test_gaps", [])
    except Exception as exc:
        logger.warning("Test Gap Agent skipped after retries: %s", exc)
        return {
            "agent_results": {"test_gaps": []},
            "agent_errors": {"test_gaps": str(exc)},
        }

    return {
        "agent_results": {"test_gaps": findings},
        "agent_errors": {},
    }


async def context_node(state: GraphState) -> dict:
    # Context/Consistency Agent Node — verifies style, skips gracefully on failure
    logger.info("Running Consistency Agent...")
    try:
        real_result = await _run_with_retry(
            "Context Agent",
            lambda: run_context_agent(
                {
                    "repo_name": state.get("repo_name") or "demo/repo",
                    "current_diff": state["pr_diff"],
                },
            ),
        )
        findings = real_result.get("context_findings", [])
    except Exception as exc:
        logger.warning("Context Agent skipped after retries: %s", exc)
        return {
            "agent_results": {"context": []},
            "agent_errors": {"context": str(exc)},
        }

    return {
        "agent_results": {"context": findings},
        "agent_errors": {},
    }


async def synthesis_node(state: GraphState) -> dict:
    # Synthesis Node — aggregates findings and determines overall severity
    logger.info("Synthesising findings...")
    results = state.get("agent_results", {})

    security = results.get("security", [])
    architecture = results.get("architecture", [])
    test_gaps = results.get("test_gaps", [])
    context = results.get("context", [])

    # Calculate overall severity
    overall = "Clean"
    all_findings = security + architecture + test_gaps + context
    for f in all_findings:
        sev = str(f.get("severity", "warning")).lower()
        if sev in ("critical", "high"):
            overall = "Critical"
            break
        elif sev in ("warning", "medium"):
            overall = "Warning"

    synthesis_output = {
        "overall_severity": overall,
        "findings": {
            "security": security,
            "architecture": architecture,
            "test_gaps": test_gaps,
            "context": context,
        },
    }

    return {"synthesis_output": synthesis_output}


async def commenter_node(state: GraphState) -> dict:
    # Commenter Node — outputs synthesis results and posts comments if configured
    logger.info("Executing Commenter Agent...")
    synthesis = state["synthesis_output"]

    # Generate the Markdown
    markdown = format_markdown_review(synthesis)
    logger.info("Generated review markdown (%d chars)", len(markdown))

    # Post comment if live repo name and pr_number are supplied
    repo = state.get("repo_name")
    pr_num = state.get("pr_number")
    if repo and pr_num and os.getenv("GITHUB_TOKEN"):
        try:
            logger.info("Posting GitHub PR comment to %s#%s...", repo, pr_num)
            await post_github_comment(repo, pr_num, markdown)
            logger.info("Successfully posted GitHub comment.")
        except Exception as exc:
            logger.warning("Failed to post comment to GitHub: %s", exc)

    return state


# -- Graph wiring (parallel fan-out / fan-in) --

workflow = StateGraph(GraphState)

# Add nodes
workflow.add_node("prepare_diff_node", prepare_diff_node)
workflow.add_node("security_node", security_node)
workflow.add_node("architecture_node", architecture_node)
workflow.add_node("test_gap_node", test_gap_node)
workflow.add_node("context_node", context_node)
workflow.add_node("synthesis_node", synthesis_node)
workflow.add_node("commenter_node", commenter_node)

# Entrance edge
workflow.add_edge(START, "prepare_diff_node")

# Parallel fan-out from prepare_diff_node
workflow.add_edge("prepare_diff_node", "security_node")
workflow.add_edge("prepare_diff_node", "architecture_node")
workflow.add_edge("prepare_diff_node", "test_gap_node")
workflow.add_edge("prepare_diff_node", "context_node")

# Parallel fan-in from agents into synthesis_node
workflow.add_edge("security_node", "synthesis_node")
workflow.add_edge("architecture_node", "synthesis_node")
workflow.add_edge("test_gap_node", "synthesis_node")
workflow.add_edge("context_node", "synthesis_node")

# Sequence: synthesis -> commenter -> END
workflow.add_edge("synthesis_node", "commenter_node")
workflow.add_edge("commenter_node", END)

# Compile graph
app = workflow.compile()


# -- Backend compatibility routines --

async def review_pr_data(pr_data: PRData) -> dict:
    # API-level PR review entrypoint — invokes compiled StateGraph
    state = await app.ainvoke({
        "pr_diff": pr_data.diff_text,
        "repo_name": pr_data.repo_name,
        "pr_number": pr_data.pr_number,
        "agent_results": {},
        "agent_errors": {},
        "synthesis_output": {},
    })

    synthesis = state["synthesis_output"]
    findings_list = []

    # Flatten findings for frontend consumption
    for category, items in synthesis["findings"].items():
        for item in items:
            findings_list.append({
                "agent": f"{category.capitalize()} Agent",
                "severity": item.get("severity", "warning"),
                "title": item.get("issue_type") or item.get("violation_type") or item.get("function") or "Style issue",
                "details": item.get("description") or item.get("missing_test") or item.get("issue") or "",
                "file": item.get("file", ""),
                "line_hint": item.get("line_hint", ""),
            })

    markdown_content = format_markdown_review(synthesis)

    return {
        "repo": pr_data.repo_name,
        "pr_number": pr_data.pr_number,
        "state": {
            "diff": pr_data.diff_text,
            "repo": pr_data.repo_name,
            "pr_number": pr_data.pr_number,
            "security_findings": synthesis["findings"].get("security", []),
            "architecture_findings": synthesis["findings"].get("architecture", []),
            "test_gaps": synthesis["findings"].get("test_gaps", []),
            "context_findings": synthesis["findings"].get("context", []),
            "consistency_findings": synthesis["findings"].get("context", []),
            "agent_errors": state.get("agent_errors", {}),
        },
        "summary": {
            "finding_count": len(findings_list),
            "highest_severity": synthesis.get("overall_severity", "Clean").lower(),
            "skipped_agents": list(state.get("agent_errors", {}).keys()),
        },
        "findings": findings_list,
        "markdown": markdown_content,
    }


async def review_diff(diff: str, repo: str | None = None, pr_number: int | None = None) -> dict:
    # Helper entrypoint to review a raw diff patch
    pr_data = PRData(
        repo_name=repo or "manual/demo",
        pr_number=pr_number or 0,
        diff_text=diff,
        pr_title="Manual diff review",
        author="manual",
    )
    return await review_pr_data(pr_data)


if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    demo = PRData(
        repo_name="demo/repo",
        pr_number=1,
        diff_text='+ password = "admin123"\n+ query = "SELECT * FROM users WHERE id = " + user_id\n+ def send_email_and_save_user_to_db(user):\n+     pass',
        pr_title="Demo",
        author="local",
    )
    logger.info("Testing compiled parallel StateGraph...")
    result = asyncio.run(review_pr_data(demo))
    logger.info("StateGraph run completed successfully.")
