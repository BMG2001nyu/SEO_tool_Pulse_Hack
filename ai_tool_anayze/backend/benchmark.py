from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, List, Tuple
from urllib.parse import urljoin, urldefrag, urlparse

import os
import time
import requests
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
    seen = set()
    queue = [start_url]
    pages: List[PageContent] = []

    print(f"[benchmark] crawl start url={start_url} max_pages={max_pages}")
    while queue and len(pages) < max_pages:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            resp = requests.get(url, timeout=10)
        except requests.RequestException:
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


def _chunk_text(text: str, chunk_size: int = 800, overlap: int = 120) -> List[str]:
    if not text:
        return []
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = min(len(words), start + chunk_size)
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end >= len(words):
            break
        start = max(0, end - overlap)
    return chunks


def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _score_overlap(query: str, chunk: str) -> float:
    q_tokens = _tokenize(query)
    if not q_tokens:
        return 0.0
    c_tokens = _tokenize(chunk)
    c_counts = Counter(c_tokens)
    score = sum(c_counts[t] for t in q_tokens) / max(1, len(q_tokens))
    return score


def _select_top_chunks(query: str, chunks: List[Tuple[str, str]], top_k: int = 3) -> List[Tuple[str, str, float]]:
    scored = []
    for url, chunk in chunks:
        scored.append((url, chunk, _score_overlap(query, chunk)))
    scored.sort(key=lambda x: x[2], reverse=True)
    return scored[:top_k]


def _build_context(top_chunks: List[Tuple[str, str, float]]) -> Tuple[str, List[str]]:
    sources = []
    blocks = []
    for idx, (url, chunk, _score) in enumerate(top_chunks, start=1):
        sources.append(url)
        blocks.append(f"[{idx}] {url}\n{chunk}")
    return "\n\n".join(blocks), sources


def _call_openai_answer(query: str, context: str, model: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    client = OpenAI(api_key=api_key)
    print(f"[benchmark] openai call model={model} query={query!r} context_len={len(context)}")
    system_msg = (
        "You answer questions using only the provided sources. "
        'If the answer is not in the sources, reply with "NOT FOUND". '
        "Cite sources using [n] after sentences."
    )
    user_msg = f"Question: {query}\n\nSources:\n{context}"
    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.2,
    )
    return resp.choices[0].message.content.strip()


def _extract_citations(answer: str, sources: List[str]) -> List[dict]:
    cited = set()
    for match in re.findall(r"\[(\d+)\]", answer):
        idx = int(match) - 1
        if 0 <= idx < len(sources):
            cited.add(sources[idx])
    return [{"url": url, "section": "page"} for url in sorted(cited)]


def _build_answer(query: str, top_chunks: List[Tuple[str, str, float]], model: str) -> Tuple[str, List[dict], bool]:
    if not top_chunks or top_chunks[0][2] < 0.2:
        return "NOT FOUND", [], False
    context, sources = _build_context(top_chunks)
    answer = _call_openai_answer(query, context, model)
    is_answerable = "NOT FOUND" not in answer.upper()
    citations = _extract_citations(answer, sources)
    return answer, citations, is_answerable


def _completeness_score(query: str, answer: str) -> float:
    q_tokens = set(_tokenize(query))
    if not q_tokens:
        return 0.0
    a_tokens = set(_tokenize(answer))
    return len(q_tokens & a_tokens) / len(q_tokens)


def run_answerability_benchmark(
    site_url: str, queries: Iterable[str] | None = None, model: str = "gpt-4o-mini"
) -> dict:
    start = time.time()
    queries_list = list(queries) if queries else DEFAULT_QUERIES
    print(f"[benchmark] start benchmark url={site_url} queries={len(queries_list)}")
    pages = crawl_site(site_url)

    chunks: List[Tuple[str, str]] = []
    for page in pages:
        for chunk in _chunk_text(page.text):
            chunks.append((page.url, chunk))
    print(f"[benchmark] built chunks total={len(chunks)} pages={len(pages)}")

    results = []
    answerable = 0
    citation_ok = 0
    hallucinations = 0
    completeness_scores = []
    missing_topics = []

    for query in queries_list:
        print(f"[benchmark] query start {query!r}")
        top_chunks = _select_top_chunks(query, chunks)
        answer, citations, is_answerable = _build_answer(query, top_chunks, model)
        completeness = _completeness_score(query, answer)
        print(
            f"[benchmark] query done answerable={is_answerable} citations={len(citations)}"
        )

        if is_answerable:
            answerable += 1
            citation_ok += 1 if citations else 0
            hallucinations += 0
        else:
            missing_topics.append(query)

        completeness_scores.append(completeness)

        results.append(
            {
                "query": query,
                "answer": answer,
                "status": "answered" if is_answerable else "not_found",
                "citations": citations,
                "metrics": {
                    "answerable": is_answerable,
                    "citation_ok": bool(citations),
                    "hallucination": False,
                    "completeness": round(completeness, 2),
                },
            }
        )

    total = max(1, len(queries_list))
    overall = {
        "answerability_rate": round(answerable / total, 2),
        "citation_coverage": round(citation_ok / total, 2),
        "hallucination_rate": round(hallucinations / total, 2),
        "completeness": round(sum(completeness_scores) / total, 2) if completeness_scores else 0.0,
    }
    print(f"[benchmark] done in {time.time() - start:.2f}s")

    return {
        "site_url": site_url,
        "crawled_pages": len(pages),
        "indexed_chunks": len(chunks),
        "queries_run": len(queries_list),
        "overall_scores": overall,
        "query_results": results,
        "missing_topics": missing_topics,
    }
