import os
import json
import subprocess
import asyncio
from pathlib import Path
from urllib.parse import urlparse
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from dotenv import load_dotenv
from openai import OpenAI

from benchmark import run_answerability_benchmark, DEFAULT_QUERIES

load_dotenv()

# Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
SITE_AUDIT_SEO_PATH = os.getenv("SITE_AUDIT_SEO_PATH", "site-audit-seo")
LLMSTXT_PATH = os.getenv("LLMSTXT_PATH", "../create-llmstxt-py")
OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./reports"))

# Ensure output directory exists
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# In-memory storage for audit sessions
audit_sessions: dict = {}

# OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Audit Flow Backend starting...")
    print(f"Output directory: {OUTPUT_DIR.absolute()}")
    yield
    # Shutdown
    print("Audit Flow Backend shutting down...")


app = FastAPI(
    title="Audit Flow API",
    description="Backend API for SEO auditing and AI-powered website analysis",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response Models
class AuditRequest(BaseModel):
    url: HttpUrl
    max_depth: int = 3
    max_urls: int = 20
    include_lighthouse: bool = False


class AuditStatusResponse(BaseModel):
    session_id: str
    status: str  # "pending", "running", "completed", "failed"
    progress: int
    message: str
    audit_data: Optional[dict] = None
    llmstxt_content: Optional[str] = None
    error: Optional[str] = None


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    response: str
    sources: Optional[list] = None


class BenchmarkRequest(BaseModel):
    session_id: str
    queries: Optional[list] = None  # Optional custom queries, uses DEFAULT_QUERIES if not provided


class BenchmarkQueryResult(BaseModel):
    query: str
    answer: str
    status: str
    citations: list
    metrics: dict


class BenchmarkResponse(BaseModel):
    session_id: str
    status: str
    site_url: Optional[str] = None
    crawled_pages: Optional[int] = None
    indexed_chunks: Optional[int] = None
    queries_run: Optional[int] = None
    overall_scores: Optional[dict] = None
    query_results: Optional[list] = None
    missing_topics: Optional[list] = None
    error: Optional[str] = None


def get_domain_from_url(url: str) -> str:
    """Extract domain name from URL."""
    parsed = urlparse(str(url))
    domain = parsed.netloc.replace("www.", "")
    return domain


async def run_site_audit(session_id: str, url: str, max_depth: int, include_lighthouse: bool):
    """Run site-audit-seo tool asynchronously."""
    domain = get_domain_from_url(url)
    output_name = f"{session_id}-{domain}"
    json_path = OUTPUT_DIR / f"{output_name}.json"

    audit_sessions[session_id]["status"] = "running"
    audit_sessions[session_id]["message"] = "Running SEO audit..."
    audit_sessions[session_id]["progress"] = 10

    try:
        cmd = [
            SITE_AUDIT_SEO_PATH,
            "-u", url,
            "--preset", "seo",
            "-d", str(max_depth),
            "-m", "5",  # Limit to 5 pages max for faster results
            "--out-dir", str(OUTPUT_DIR),
            "--out-name", output_name,
            "--json",
            "--no-remove-csv",
        ]

        if include_lighthouse:
            cmd.append("--lighthouse")

        # Run from backend directory so data/reports/ exists for site-audit-seo
        backend_dir = Path(__file__).parent.absolute()

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(backend_dir),
        )

        # Poll for JSON file instead of waiting for process (it may hang)
        timeout = 120  # 2 minutes max
        poll_interval = 2  # Check every 2 seconds
        elapsed = 0
        process_failed = False
        error_message = ""

        while elapsed < timeout:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

            # Check if JSON file exists and has content
            if json_path.exists() and json_path.stat().st_size > 100:
                # Give it a moment to finish writing
                await asyncio.sleep(1)
                break

            # Check if process failed
            if process.returncode is not None and process.returncode != 0:
                stderr = await process.stderr.read()
                error_message = stderr.decode()
                process_failed = True
                break

        # Kill process if still running (it may hang on viewer)
        if process.returncode is None:
            try:
                process.terminate()
                await asyncio.sleep(1)
                if process.returncode is None:
                    process.kill()
            except:
                pass

        # Read the generated JSON if it exists
        if json_path.exists():
            with open(json_path, "r") as f:
                audit_data = json.load(f)
            audit_sessions[session_id]["audit_data"] = audit_data
            audit_sessions[session_id]["progress"] = 50
            audit_sessions[session_id]["message"] = "SEO audit complete. Generating LLM context..."
        elif process_failed:
            # If site-audit-seo failed (e.g., puppeteer redirect issue), create minimal audit data
            print(f"site-audit-seo failed, creating minimal audit data: {error_message[:200]}")
            audit_sessions[session_id]["audit_data"] = {
                "items": [{"url": url, "status": 200, "title": "Unable to crawl - using basic mode", "h1": ""}],
                "fields": [],
                "scan": {"url": url, "time": 0, "startTime": 0}
            }
            audit_sessions[session_id]["progress"] = 50
            audit_sessions[session_id]["message"] = "Basic audit mode (full crawl unavailable). Generating LLM context..."
        else:
            raise Exception(f"Audit JSON not found at {json_path} after {timeout}s")

    except Exception as e:
        # Even on error, try to continue with minimal data
        print(f"Audit error, continuing with minimal data: {e}")
        audit_sessions[session_id]["audit_data"] = {
            "items": [{"url": url, "status": 200, "title": "Audit error - basic mode", "h1": ""}],
            "fields": [],
            "scan": {"url": url, "time": 0, "startTime": 0}
        }
        audit_sessions[session_id]["progress"] = 50
        audit_sessions[session_id]["message"] = "Continuing in basic mode..."


async def run_llmstxt_generation(session_id: str, url: str, max_urls: int):
    """Run create-llmstxt-py tool asynchronously."""
    domain = get_domain_from_url(url)
    output_dir = OUTPUT_DIR / session_id
    output_dir.mkdir(parents=True, exist_ok=True)

    audit_sessions[session_id]["message"] = "Generating LLM context file..."
    audit_sessions[session_id]["progress"] = 60

    try:
        llmstxt_script = Path(LLMSTXT_PATH) / "generate-llmstxt.py"

        if not llmstxt_script.exists():
            raise Exception(f"create-llmstxt-py script not found at {llmstxt_script}")

        cmd = [
            "python3",
            str(llmstxt_script),
            url,
            "--max-urls", str(max_urls),
            "--output-dir", str(output_dir),
            "--firecrawl-api-key", FIRECRAWL_API_KEY or "",
            "--openai-api-key", OPENAI_API_KEY or "",
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Add 60 second timeout for llmstxt generation
        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=60.0
            )

            if process.returncode != 0:
                print(f"llmstxt generation warning: {stderr.decode()}")
                audit_sessions[session_id]["llmstxt_content"] = None
            else:
                # Find and read the generated llms-full.txt
                llms_full_path = output_dir / f"{domain}-llms-full.txt"
                llms_path = output_dir / f"{domain}-llms.txt"

                if llms_full_path.exists():
                    with open(llms_full_path, "r") as f:
                        audit_sessions[session_id]["llmstxt_content"] = f.read()
                elif llms_path.exists():
                    with open(llms_path, "r") as f:
                        audit_sessions[session_id]["llmstxt_content"] = f.read()
                else:
                    audit_sessions[session_id]["llmstxt_content"] = None

        except asyncio.TimeoutError:
            print("llmstxt generation timed out after 60s, skipping...")
            process.kill()
            audit_sessions[session_id]["llmstxt_content"] = None

        audit_sessions[session_id]["progress"] = 90
        audit_sessions[session_id]["message"] = "Finalizing..."

    except Exception as e:
        print(f"llmstxt generation error: {e}")
        audit_sessions[session_id]["llmstxt_content"] = None


async def run_full_audit(session_id: str, url: str, max_depth: int, max_urls: int, include_lighthouse: bool):
    """Run the complete audit pipeline."""
    try:
        # Run SEO audit
        await run_site_audit(session_id, url, max_depth, include_lighthouse)

        if audit_sessions[session_id]["status"] == "failed":
            return

        # Run llmstxt generation
        await run_llmstxt_generation(session_id, url, max_urls)

        # Mark as completed
        audit_sessions[session_id]["status"] = "completed"
        audit_sessions[session_id]["progress"] = 100
        audit_sessions[session_id]["message"] = "Audit complete!"

    except Exception as e:
        audit_sessions[session_id]["status"] = "failed"
        audit_sessions[session_id]["error"] = str(e)
        audit_sessions[session_id]["message"] = f"Audit failed: {str(e)}"


@app.get("/")
async def root():
    return {"message": "Audit Flow API", "version": "1.0.0"}


@app.post("/api/audit", response_model=AuditStatusResponse)
async def start_audit(request: AuditRequest, background_tasks: BackgroundTasks):
    """Start a new audit for the given URL."""
    import uuid

    session_id = str(uuid.uuid4())[:8]
    url = str(request.url)

    # Initialize session
    audit_sessions[session_id] = {
        "url": url,
        "status": "pending",
        "progress": 0,
        "message": "Audit queued...",
        "audit_data": None,
        "llmstxt_content": None,
        "error": None,
    }

    # Start audit in background
    background_tasks.add_task(
        run_full_audit,
        session_id,
        url,
        request.max_depth,
        request.max_urls,
        request.include_lighthouse,
    )

    return AuditStatusResponse(
        session_id=session_id,
        status="pending",
        progress=0,
        message="Audit started...",
    )


@app.get("/api/audit/{session_id}", response_model=AuditStatusResponse)
async def get_audit_status(session_id: str):
    """Get the status of an audit session."""
    if session_id not in audit_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = audit_sessions[session_id]

    return AuditStatusResponse(
        session_id=session_id,
        status=session["status"],
        progress=session["progress"],
        message=session["message"],
        audit_data=session.get("audit_data"),
        llmstxt_content=session.get("llmstxt_content"),
        error=session.get("error"),
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Chat with AI about the audited website."""
    if not openai_client:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    session_id = request.session_id

    if session_id not in audit_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = audit_sessions[session_id]

    if session["status"] != "completed":
        raise HTTPException(status_code=400, detail="Audit not yet completed")

    # Build context from llmstxt and audit data
    context_parts = []

    # Add llmstxt content if available
    if session.get("llmstxt_content"):
        context_parts.append(f"Website Content:\n{session['llmstxt_content'][:15000]}")

    # Add audit summary
    if session.get("audit_data"):
        audit = session["audit_data"]
        items = audit.get("items", [])

        summary = f"\nSEO Audit Summary for {session['url']}:\n"
        summary += f"- Total pages scanned: {len(items)}\n"

        if items:
            # Calculate averages/counts
            status_codes = {}
            titles_missing = 0
            h1_missing = 0

            for item in items:
                status = item.get("status", 0)
                status_codes[status] = status_codes.get(status, 0) + 1
                if not item.get("title"):
                    titles_missing += 1
                if not item.get("h1"):
                    h1_missing += 1

            summary += f"- Status codes: {status_codes}\n"
            summary += f"- Pages missing title: {titles_missing}\n"
            summary += f"- Pages missing H1: {h1_missing}\n"

            # Add first few page details
            summary += "\nTop pages:\n"
            for item in items[:5]:
                summary += f"  - {item.get('url', 'N/A')}: {item.get('title', 'No title')}\n"

        context_parts.append(summary)

    context = "\n\n".join(context_parts)

    # Call OpenAI
    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You are an SEO expert assistant. You help users understand their website's SEO audit results and provide actionable recommendations.

Use the provided website content and audit data to answer questions accurately. Be specific and reference actual data from the audit when possible.

Focus on:
- SEO issues and how to fix them
- Content optimization opportunities
- Technical SEO recommendations
- Performance improvements"""
                },
                {
                    "role": "user",
                    "content": f"Website context:\n{context}\n\nUser question: {request.message}"
                }
            ],
            max_tokens=1000,
            temperature=0.7,
        )

        return ChatResponse(
            response=response.choices[0].message.content,
            sources=None,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "openai_configured": bool(OPENAI_API_KEY),
        "firecrawl_configured": bool(FIRECRAWL_API_KEY),
    }


@app.get("/api/benchmark/questions")
async def get_benchmark_questions():
    """Get the default benchmark questions."""
    return {"questions": DEFAULT_QUERIES}


@app.post("/api/benchmark", response_model=BenchmarkResponse)
async def run_benchmark(request: BenchmarkRequest, background_tasks: BackgroundTasks):
    """Run the answerability benchmark for a session's URL."""
    session_id = request.session_id

    if session_id not in audit_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = audit_sessions[session_id]
    url = session.get("url")

    if not url:
        raise HTTPException(status_code=400, detail="No URL in session")

    # Initialize benchmark status in session
    audit_sessions[session_id]["benchmark_status"] = "running"
    audit_sessions[session_id]["benchmark_data"] = None

    # Run benchmark in background
    background_tasks.add_task(
        run_benchmark_task,
        session_id,
        url,
        request.queries,
    )

    return BenchmarkResponse(
        session_id=session_id,
        status="running",
    )


async def run_benchmark_task(session_id: str, url: str, custom_queries: Optional[list] = None):
    """Run the benchmark asynchronously."""
    try:
        queries = custom_queries if custom_queries else None

        # Run benchmark in a thread to avoid blocking the event loop
        result = await asyncio.to_thread(
            run_answerability_benchmark,
            url,
            queries,
            "gpt-4o-mini"  # Use fast model for benchmark
        )

        audit_sessions[session_id]["benchmark_status"] = "completed"
        audit_sessions[session_id]["benchmark_data"] = result

    except Exception as e:
        import traceback
        traceback.print_exc()
        audit_sessions[session_id]["benchmark_status"] = "failed"
        audit_sessions[session_id]["benchmark_data"] = {"error": str(e)}


@app.get("/api/benchmark/{session_id}", response_model=BenchmarkResponse)
async def get_benchmark_status(session_id: str):
    """Get the status of a benchmark run."""
    if session_id not in audit_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = audit_sessions[session_id]
    benchmark_status = session.get("benchmark_status")
    benchmark_data = session.get("benchmark_data")

    if not benchmark_status:
        return BenchmarkResponse(
            session_id=session_id,
            status="not_started",
        )

    if benchmark_status == "running":
        return BenchmarkResponse(
            session_id=session_id,
            status="running",
        )

    if benchmark_status == "failed":
        return BenchmarkResponse(
            session_id=session_id,
            status="failed",
            error=benchmark_data.get("error") if benchmark_data else "Unknown error",
        )

    # Completed
    return BenchmarkResponse(
        session_id=session_id,
        status="completed",
        site_url=benchmark_data.get("site_url"),
        crawled_pages=benchmark_data.get("crawled_pages"),
        indexed_chunks=benchmark_data.get("indexed_chunks"),
        queries_run=benchmark_data.get("queries_run"),
        overall_scores=benchmark_data.get("overall_scores"),
        query_results=benchmark_data.get("query_results"),
        missing_topics=benchmark_data.get("missing_topics"),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
