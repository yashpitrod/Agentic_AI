import anthropic
import os
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = "claude-sonnet-4-20250514"

def call_claude(prompt: str, system: str = "", max_tokens: int = 2000) -> str:
    messages = [{"role": "user", "content": prompt}]
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages
    )
    return response.content[0].text

async def call_claude_async(prompt: str, system: str = "", max_tokens: int = 2000) -> str:
    # Use for asyncio.gather() parallel agent calls
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: call_claude(prompt, system, max_tokens))