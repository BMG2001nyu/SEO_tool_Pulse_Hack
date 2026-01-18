const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface AuditRequest {
  url: string;
  max_depth?: number;
  max_urls?: number;
  include_lighthouse?: boolean;
}

export interface AuditItem {
  url: string;
  status: number;
  title?: string;
  h1?: string;
  description?: string;
  canonical?: string;
  h1_count?: number;
  h2_count?: number;
  images?: number;
  images_without_alt?: number;
  links?: number;
  links_inner?: number;
  links_outer?: number;
  dom_size?: number;
  html_size?: number;
  request_time?: number;
  lighthouse_scores_performance?: number;
  lighthouse_scores_accessibility?: number;
  lighthouse_scores_seo?: number;
  [key: string]: unknown;
}

export interface AuditData {
  items: AuditItem[];
  fields: Array<{ name: string; comment: string }>;
  scan: {
    url: string;
    time: number;
    startTime: number;
  };
}

export interface AuditStatusResponse {
  session_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string;
  audit_data?: AuditData;
  llmstxt_content?: string;
  error?: string;
}

export interface ChatResponse {
  response: string;
  sources?: string[];
}

export interface BenchmarkQueryResult {
  query: string;
  answer: string;
  status: 'answered' | 'not_found';
  citations: Array<{ url: string; section: string }>;
  metrics: {
    answerable: boolean;
    citation_ok: boolean;
    hallucination: boolean;
    completeness: number;
  };
}

export interface BenchmarkOverallScores {
  answerability_rate: number;
  citation_coverage: number;
  hallucination_rate: number;
  completeness: number;
}

export interface BenchmarkResponse {
  session_id: string;
  status: 'not_started' | 'running' | 'completed' | 'failed';
  site_url?: string;
  crawled_pages?: number;
  indexed_chunks?: number;
  queries_run?: number;
  overall_scores?: BenchmarkOverallScores;
  query_results?: BenchmarkQueryResult[];
  missing_topics?: string[];
  error?: string;
}

export async function startAudit(request: AuditRequest): Promise<AuditStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to start audit: ${response.statusText}`);
  }

  return response.json();
}

export async function getAuditStatus(sessionId: string): Promise<AuditStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/api/audit/${sessionId}`);

  if (!response.ok) {
    throw new Error(`Failed to get audit status: ${response.statusText}`);
  }

  return response.json();
}

export async function sendChatMessage(sessionId: string, message: string): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      message,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string; openai_configured: boolean; firecrawl_configured: boolean }> {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  return response.json();
}

export async function getBenchmarkQuestions(): Promise<{ questions: string[] }> {
  const response = await fetch(`${API_BASE_URL}/api/benchmark/questions`);
  return response.json();
}

export async function startBenchmark(sessionId: string, queries?: string[]): Promise<BenchmarkResponse> {
  const response = await fetch(`${API_BASE_URL}/api/benchmark`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: sessionId,
      queries: queries || null,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start benchmark: ${response.statusText}`);
  }

  return response.json();
}

export async function getBenchmarkStatus(sessionId: string): Promise<BenchmarkResponse> {
  const response = await fetch(`${API_BASE_URL}/api/benchmark/${sessionId}`);

  if (!response.ok) {
    throw new Error(`Failed to get benchmark status: ${response.statusText}`);
  }

  return response.json();
}
