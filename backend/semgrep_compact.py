"""Shrink raw semgrep_scan output so it fits in small LLM token budgets (e.g. Groq's free tier)."""

import json

MAX_FINDINGS = 20
MAX_CHARS = 3500
MAX_MESSAGE_CHARS = 160
OMITTED_RESERVE = 40  # room for the "more findings omitted" line


def compact_semgrep_output(text: str, max_findings: int = MAX_FINDINGS, max_chars: int = MAX_CHARS) -> str:
    """One short line per finding instead of the full JSON (metadata, fingerprints, long messages)."""
    try:
        data = json.loads(text)
    except ValueError:
        return text[:max_chars]
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        return text[:max_chars]

    lines = [f"Semgrep found {len(results)} issue(s)."]
    used = len(lines[0])
    seen = set()
    shown = 0
    for result in results:
        extra = result.get("extra") or {}
        metadata = extra.get("metadata") or {}
        line = (result.get("start") or {}).get("line")
        rule = str(result.get("check_id", "")).split(".")[-1]
        if (rule, line) in seen:
            continue
        seen.add((rule, line))
        cwe = metadata.get("cwe")
        if isinstance(cwe, list):
            cwe = cwe[0] if cwe else ""
        message = " ".join(str(extra.get("message", "")).split())[:MAX_MESSAGE_CHARS]
        entry = f"- line {line} | {rule} | {extra.get('severity', '')} | {str(cwe or '')[:40]} | {message}"
        if shown == max_findings or used + len(entry) + 1 > max_chars - OMITTED_RESERVE:
            lines.append("... more findings omitted")
            break
        lines.append(entry)
        used += len(entry) + 1
        shown += 1
    return "\n".join(lines)
