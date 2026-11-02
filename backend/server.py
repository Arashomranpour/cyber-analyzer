import tempfile  # to create a file on disk for semgrep_scan
import os
import logging
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List
from dotenv import load_dotenv
from groq import AuthenticationError, Groq, RateLimitError
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent

from context import SECURITY_RESEARCHER_INSTRUCTIONS, get_analysis_prompt, enhance_summary
from mcp_servers import load_semgrep_tools

load_dotenv(override=True)

logger = logging.getLogger("cyber-analyzer")
MAX_CODE_CHARS = 100_000

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

app = FastAPI(title="Cybersecurity Analyzer API")

# Configure CORS for development and production
cors_origins = [
    "http://localhost:3000",  # Local development
    "http://frontend:3000",  # Docker development
]

# In production, allow same-origin requests (static files served from same domain)
if os.getenv("ENVIRONMENT") == "production":
    cors_origins.append(
        "*"
    )  # Allow all origins in production since we serve frontend from same domain

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    code: str


class SecurityIssue(BaseModel):
    title: str = Field(description="Brief title of the security vulnerability")
    description: str = Field(
        description="Detailed description of the security issue and its potential impact"
    )
    code: str = Field(
        description="The specific vulnerable code snippet that demonstrates the issue"
    )
    fix: str = Field(description="Recommended code fix or mitigation strategy")
    cvss_score: float = Field(description="CVSS score from 0.0 to 10.0 representing severity")
    severity: str = Field(description="Severity level: critical, high, medium, or low")
    cwe: str = Field(
        default="", description="Most relevant CWE identifier, e.g. 'CWE-89' (empty if unknown)"
    )
    owasp: str = Field(
        default="",
        description="Most relevant OWASP Top 10 category, e.g. 'A03:2021 Injection' (empty if unknown)",
    )


class SecurityReport(BaseModel):
    summary: str = Field(description="Executive summary of the security analysis")
    issues: List[SecurityIssue] = Field(description="List of identified security vulnerabilities")


def validate_request(request: AnalyzeRequest) -> None:
    """Validate the analysis request."""
    if not request.code.strip():
        raise HTTPException(status_code=400, detail="No code provided for analysis")
    if len(request.code) > MAX_CODE_CHARS:
        raise HTTPException(
            status_code=413, detail=f"Code is too large (limit {MAX_CODE_CHARS:,} characters)."
        )


def require_groq_key(x_groq_api_key: str | None) -> str:
    """Bring-your-own-key: the key comes from the caller only, never from the server environment."""
    key = (x_groq_api_key or "").strip()
    if not key:
        raise HTTPException(status_code=401, detail="Connect your Groq API key to analyze code.")
    if not key.startswith("gsk_"):
        raise HTTPException(
            status_code=401, detail="That doesn't look like a Groq API key (they start with gsk_)."
        )
    return key


def create_security_agent(semgrep_tools, groq_api_key: str):
    """Create the LangGraph agent that runs semgrep and returns a SecurityReport."""
    llm = ChatGroq(model=GROQ_MODEL, api_key=groq_api_key, temperature=0)
    return create_react_agent(
        llm,
        semgrep_tools,
        prompt=SECURITY_RESEARCHER_INSTRUCTIONS,
        response_format=SecurityReport,
    )


async def run_security_analysis(code: str, groq_api_key: str) -> SecurityReport:
    """Execute the security analysis workflow."""
    semgrep_tools = await load_semgrep_tools()
    agent = create_security_agent(semgrep_tools, groq_api_key)
    with tempfile.NamedTemporaryFile(  # Creates a temporary file locally with the code
        mode="w", suffix=".py", delete=False
    ) as temp:
        temp.write(code)
        temp_path = temp.name
    try:
        result = await agent.ainvoke(
            {"messages": [("user", get_analysis_prompt(code, temp_path))]}
        )  # Sends code and path to the file
        report: SecurityReport = result["structured_response"]
        # Sort by CVSS in descending order
        report.issues.sort(key=lambda issue: issue.cvss_score, reverse=True)
        return report
    finally:
        try:
            os.unlink(temp_path)
        except OSError:
            pass


def format_analysis_response(code: str, report: SecurityReport) -> SecurityReport:
    """Format the final analysis response."""
    enhanced_summary = enhance_summary(len(code), report.summary)
    return SecurityReport(summary=enhanced_summary, issues=report.issues)


@app.post("/api/validate-key")
async def validate_key(x_groq_api_key: str | None = Header(default=None)):
    """Cheaply check a Groq key by listing models (spends no tokens)."""
    key = require_groq_key(x_groq_api_key)
    try:
        available = {m.id for m in Groq(api_key=key, max_retries=1).models.list().data}
    except AuthenticationError:
        raise HTTPException(
            status_code=401, detail="Groq rejected this key. Check it at console.groq.com/keys."
        )
    except Exception:
        logger.exception("Groq key validation failed")
        raise HTTPException(status_code=502, detail="Couldn't reach Groq to check the key.")
    if GROQ_MODEL not in available:
        raise HTTPException(status_code=403, detail=f"This key can't use the model {GROQ_MODEL}.")
    return {"valid": True, "model": GROQ_MODEL}


@app.post("/api/analyze", response_model=SecurityReport)
async def analyze_code(
    request: AnalyzeRequest, x_groq_api_key: str | None = Header(default=None)
) -> SecurityReport:
    """
    Analyze Python code for security vulnerabilities using Groq (via LangChain/LangGraph) and Semgrep.

    This endpoint combines static analysis via Semgrep with AI-powered security analysis
    to provide comprehensive vulnerability detection and remediation guidance.
    The caller's own Groq key is used (X-Groq-Api-Key header) and is never stored or logged.
    """
    validate_request(request)
    key = require_groq_key(x_groq_api_key)

    try:
        report = await run_security_analysis(request.code, key)
        return format_analysis_response(request.code, report)
    except HTTPException:
        raise
    except RateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Your Groq key has hit its rate limit. Please wait a minute and try again.",
        )
    except AuthenticationError:
        raise HTTPException(
            status_code=401, detail="Groq rejected the API key. Please connect a key again."
        )
    except Exception:
        # Provider errors can contain org details, so log them server-side only.
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail="Analysis failed. Please try again.")


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"message": "Cybersecurity Analyzer API"}


# Mount static files for frontend
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
