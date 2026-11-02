"""
MCP server configurations and setup for security analysis tools.
"""

import os
from datetime import timedelta
from typing import Any, Dict, List

from langchain_core.tools import BaseTool, StructuredTool
from langchain_mcp_adapters.client import MultiServerMCPClient

from semgrep_compact import compact_semgrep_output

ALLOWED_TOOLS = {"semgrep_scan"}


def get_semgrep_server_params() -> Dict[str, Any]:
    """Get configuration parameters for the Semgrep MCP server."""
    env = {
        "SEMGREP_APP_TOKEN": os.getenv("SEMGREP_APP_TOKEN"),
        "PYTHONUNBUFFERED": "1",  # Ensure output is not buffered
    }

    return {
        "transport": "stdio",
        "command": "semgrep",
        "args": ["mcp"],
        "env": {k: v for k, v in env.items() if v is not None},
        "session_kwargs": {"read_timeout_seconds": timedelta(seconds=240)},
    }


def compact_tool(tool: BaseTool) -> BaseTool:
    """Wrap a tool so its (very verbose) output is shrunk before it goes back to the LLM."""

    async def run(**kwargs: Any) -> str:
        output = await tool.ainvoke(kwargs)
        if isinstance(output, list):
            output = "\n".join(
                block.get("text", "") if isinstance(block, dict) else str(block) for block in output
            )
        return compact_semgrep_output(str(output))

    return StructuredTool(
        name=tool.name,
        description=tool.description,
        args_schema=tool.args_schema,
        coroutine=run,
    )


async def load_semgrep_tools() -> List[BaseTool]:
    """Load the Semgrep MCP tools as LangChain tools (only semgrep_scan is exposed)."""
    client = MultiServerMCPClient({"semgrep": get_semgrep_server_params()})
    tools = await client.get_tools()
    return [compact_tool(tool) for tool in tools if tool.name in ALLOWED_TOOLS]
