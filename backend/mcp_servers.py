"""
MCP server configurations and setup for security analysis tools.
"""

import os
from datetime import timedelta
from typing import Any, Dict, List

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

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


async def load_semgrep_tools() -> List[BaseTool]:
    """Load the Semgrep MCP tools as LangChain tools (only semgrep_scan is exposed)."""
    client = MultiServerMCPClient({"semgrep": get_semgrep_server_params()})
    tools = await client.get_tools()
    return [tool for tool in tools if tool.name in ALLOWED_TOOLS]
