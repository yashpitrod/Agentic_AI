# One place for all system prompts and prompt templates
# Makes it easy to tune without hunting through code

AGENT_1_SYSTEM = """
You are [Agent 1 role]. Your job is to [what it does].
Always respond in valid JSON matching this schema:
{ ... }
"""

AGENT_2_SYSTEM = """
You are [Agent 2 role]. ...
"""