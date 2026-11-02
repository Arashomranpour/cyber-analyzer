import asyncio
import json

from langchain_core.tools import StructuredTool

from mcp_servers import compact_tool
from semgrep_compact import MAX_CHARS, compact_semgrep_output


def _finding(i: int) -> dict:
    return {
        "check_id": f"python.lang.security.rule-{i}",
        "path": "tmp.py",
        "start": {"line": i, "col": 1},
        "extra": {
            "message": "A very long explanation. " * 200,
            "severity": "ERROR",
            "metadata": {"cwe": ["CWE-89: SQL Injection"], "references": ["https://x"] * 50},
            "fingerprint": "f" * 500,
        },
    }


def test_compacts_large_semgrep_json():
    raw = json.dumps({"results": [_finding(i) for i in range(60)]})
    out = compact_semgrep_output(raw)
    assert len(raw) > 100_000
    assert len(out) <= MAX_CHARS
    assert out.startswith("Semgrep found 60 issue(s).")
    assert "CWE-89" in out and "more findings omitted" in out


def test_non_json_is_truncated():
    assert len(compact_semgrep_output("x" * 50_000)) == MAX_CHARS


def test_wrapped_tool_returns_compact_text():
    raw = json.dumps({"results": [_finding(i) for i in range(30)]})

    async def scan(path: str) -> list:
        return [{"type": "text", "text": raw}]

    original = StructuredTool.from_function(coroutine=scan, name="semgrep_scan", description="scan")
    wrapped = compact_tool(original)
    out = asyncio.run(wrapped.ainvoke({"path": "tmp.py"}))
    assert wrapped.name == "semgrep_scan"
    assert len(out) <= MAX_CHARS and out.startswith("Semgrep found 30 issue(s).")
