// ============================================================================
// FILE: src/ui/api.ts
// PURPOSE: Frontend API client - makes HTTP calls to the backend server
// ============================================================================

const API_URL = 'http://localhost:3001/api';

// Store GitHub token in memory
let githubToken: string | null = null;

export function setGitHubToken(token: string) {
  githubToken = token;
}

export function getGitHubToken(): string | null {
  return githubToken;
}

// ============================================================================
// GitHub Auth
// ============================================================================

export async function validateAndGetUser(token: string): Promise<{
  name: string;
  avatar: string;
  login: string;
}> {
  const res = await fetch(`${API_URL}/auth/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Authentication failed');
  }

  setGitHubToken(token);
  return await res.json();
}

// ============================================================================
// Fetch Repos
// ============================================================================

export async function fetchRepos(): Promise<{
  name: string;
  desc: string;
  lang: string;
  stars: number;
  updated: string;
  private: boolean;
}[]> {
  const token = getGitHubToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_URL}/repos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to fetch repos');
  }

  return await res.json();
}

// ============================================================================
// Analyze Repo
// ============================================================================

export async function analyzeRepo(
  repoName: string,
  onProgress?: (message: string, percent: number) => void
): Promise<{
  name: string;
  type: 'function' | 'interface' | 'class' | 'type';
  complexity: number;
  lines: number;
  file: string;
}[]> {
  const token = getGitHubToken();

  // Note: Progress callbacks won't work with HTTP - would need WebSockets/SSE
  onProgress?.('Analyzing repository...', 50);

  const res = await fetch(`${API_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoName, token })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Analysis failed');
  }

  onProgress?.('Complete!', 100);
  return await res.json();
}

// ============================================================================
// Ask Question
// ============================================================================

export async function askQuestion(
  repoName: string,
  question: string,
  maxTokens: number = 2000
): Promise<{
  answer: string;
  context: string;
  queryType: string;
  confidence: number;
  tokens: number;
  searchTimeMs: number;
  entities: string[];
}> {
  const res = await fetch(`${API_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoName, question, maxTokens })
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Query failed');
  }

  return await res.json();
}

// ============================================================================
// Check if repo is indexed
// ============================================================================

export async function isIndexed(repoName: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/indexed?repo=${encodeURIComponent(repoName)}`);
  const data = await res.json();
  return data.indexed;
}
