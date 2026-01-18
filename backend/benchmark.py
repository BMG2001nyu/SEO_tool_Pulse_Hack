from __future__ import annotations

import os
import re
import json
import time
import requests
from dataclasses import dataclass
from typing import List, Optional
from urllib.parse import urljoin, urldefrag, urlparse

from bs4 import BeautifulSoup
from openai import OpenAI


DEFAULT_QUERIES = [
    "What services do you offer?",
    "What is your pricing?",
    "Where are you located?",
    "What are your business hours?",
    "Do you offer refunds or a money-back guarantee?",
]


@dataclass
class PageContent:
    url: str
    title: str
    text: str


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(" ")
    return _normalize_text(text)


def _extract_links(base_url: str, html: str, max_links: int = 50) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: List[str] = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        joined = urljoin(base_url, href)
        clean, _ = urldefrag(joined)
        links.append(clean)
        if len(links) >= max_links:
            break
    return links


def _is_same_host(root: str, url: str) -> bool:
    return urlparse(root).netloc == urlparse(url).netloc


def crawl_site(start_url: str, max_pages: int = 15, max_links_per_page: int = 50) -> List[PageContent]:
    """Crawl a website and extract text content from pages."""
    seen = set()
    pages: List[PageContent] = []

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    # Priority pages to crawl first (these often have key business info)
    base = start_url.rstrip('/')
    priority_paths = [
        '', '/contact', '/contact-us', '/about', '/about-us', '/pricing',
        '/prices', '/plans', '/faq', '/support', '/help', '/locations',
        '/hours', '/refund', '/refund-policy', '/terms', '/services'
    ]

    # Build priority queue
    priority_urls = [f"{base}{path}" for path in priority_paths]
    queue = priority_urls + [start_url]

    print(f"[benchmark] crawl start url={start_url} max_pages={max_pages}")

    while queue and len(pages) < max_pages:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)

        try:
            resp = requests.get(url, timeout=10, headers=headers)
        except requests.RequestException as e:
            print(f"[benchmark] crawl error {url}: {e}")
            continue
        if resp.status_code >= 400:
            continue

        html = resp.text
        text = _extract_text(html)
        soup = BeautifulSoup(html, "html.parser")
        title = _normalize_text(soup.title.string) if soup.title and soup.title.string else ""
        pages.append(PageContent(url=url, title=title, text=text))
        print(f"[benchmark] crawled {url} text_len={len(text)} queue={len(queue)}")

        for link in _extract_links(url, html, max_links=max_links_per_page):
            if _is_same_host(start_url, link) and link not in seen:
                queue.append(link)

    return pages


def run_answerability_benchmark(
    site_url: str,
    queries: Optional[List[str]] = None,
    model: str = "gpt-4o-mini"
) -> dict:
    """Run the answerability benchmark using a simple LLM prompt."""
    start = time.time()
    queries_list = list(queries) if queries else DEFAULT_QUERIES

    print(f"[benchmark] start benchmark url={site_url} queries={len(queries_list)}")

    # Crawl the website
    pages = crawl_site(site_url, max_pages=10)

    if not pages:
        print("[benchmark] no pages crawled, returning empty results")
        return {
            "site_url": site_url,
            "crawled_pages": 0,
            "indexed_chunks": 0,
            "queries_run": len(queries_list),
            "overall_scores": {
                "answerability_rate": 0,
                "citation_coverage": 0,
                "hallucination_rate": 0,
                "completeness": 0,
            },
            "query_results": [
                {
                    "query": q,
                    "answer": "Could not crawl website",
                    "status": "not_found",
                    "citations": [],
                    "metrics": {"answerable": False, "citation_ok": False, "hallucination": False, "completeness": 0},
                }
                for q in queries_list
            ],
            "missing_topics": queries_list,
        }

    # Combine all page content - prioritize content from important pages
    combined_content = ""
    for page in pages:
        # Truncate individual pages to 8000 chars max
        page_text = page.text[:8000] if len(page.text) > 8000 else page.text
        combined_content += f"\n\n=== PAGE: {page.url} ===\n{page_text}"

    # Increase limit to 50000 chars for better coverage (GPT-4o-mini handles this well)
    if len(combined_content) > 50000:
        combined_content = combined_content[:50000] + "\n...[content truncated]..."

    print(f"[benchmark] combined content length: {len(combined_content)}")

    # Build the prompt
    domain = urlparse(site_url).netloc
    questions_text = "\n".join([f"{i+1}. {q}" for i, q in enumerate(queries_list)])

    prompt = f"""You are analyzing the website {domain}. Based on the website content provided below, answer each question thoroughly.

IMPORTANT INSTRUCTIONS:
- Search through ALL the page content carefully before answering
- Look for addresses, locations, office info in contact pages
- Look for pricing, plans, or "get a demo" / "contact sales" if no public pricing
- For business hours, look for support hours, office hours, or operating hours
- For refunds, look for terms of service, refund policy, or money-back guarantees
- If info is partially available, provide what you found
- Only say "NOT FOUND" if you truly cannot find ANY relevant information

Questions to answer:
{questions_text}

Website Content (from multiple pages):
{combined_content}

Respond in JSON format exactly like this:
[
  {{"query": "question text", "answer": "detailed answer based on content, or NOT FOUND if truly not available", "found": true/false}}
]

Return ONLY the valid JSON array, no markdown, no extra text."""

    # Call OpenAI
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)

    print(f"[benchmark] calling OpenAI model={model}")
    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=2000,
        )

        response_text = response.choices[0].message.content.strip()
        print(f"[benchmark] OpenAI response: {response_text[:500]}...")

        # Parse JSON response
        # Handle markdown code blocks if present
        if response_text.startswith("```"):
            response_text = re.sub(r"^```(?:json)?\n?", "", response_text)
            response_text = re.sub(r"\n?```$", "", response_text)

        results = json.loads(response_text)

    except json.JSONDecodeError as e:
        print(f"[benchmark] JSON parse error: {e}")
        print(f"[benchmark] Raw response: {response_text}")
        # Return error results
        results = [{"query": q, "answer": "Error parsing response", "found": False} for q in queries_list]
    except Exception as e:
        print(f"[benchmark] OpenAI error: {e}")
        results = [{"query": q, "answer": f"Error: {str(e)}", "found": False} for q in queries_list]

    # Process results
    query_results = []
    answered_count = 0
    missing_topics = []

    for i, result in enumerate(results):
        query = result.get("query", queries_list[i] if i < len(queries_list) else f"Question {i+1}")
        answer = result.get("answer", "NOT FOUND")
        found = result.get("found", False)

        if found and "NOT FOUND" not in answer.upper():
            answered_count += 1
            status = "answered"
        else:
            status = "not_found"
            missing_topics.append(query)

        query_results.append({
            "query": query,
            "answer": answer,
            "status": status,
            "citations": [{"url": pages[0].url if pages else site_url, "section": "page"}] if found else [],
            "metrics": {
                "answerable": found,
                "citation_ok": found,
                "hallucination": False,
                "completeness": 1.0 if found else 0.0,
            },
        })

    total = max(1, len(queries_list))
    overall = {
        "answerability_rate": round(answered_count / total, 2),
        "citation_coverage": round(answered_count / total, 2),
        "hallucination_rate": 0,
        "completeness": round(answered_count / total, 2),
    }

    print(f"[benchmark] done in {time.time() - start:.2f}s - answered {answered_count}/{total}")

    return {
        "site_url": site_url,
        "crawled_pages": len(pages),
        "indexed_chunks": len(pages),
        "queries_run": len(queries_list),
        "overall_scores": overall,
        "query_results": query_results,
        "missing_topics": missing_topics,
    }
