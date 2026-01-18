// ============================================================================
// FILE: src/ui/api.ts
// PURPOSE: Frontend API client - makes HTTP calls to the backend server
// Supports both local processing and MCP server (via proxy)
// ============================================================================

const API_URL = 'http://localhost:3001/api';

// Toggle between local processing and MCP server
// true = use deployed MCP server (via local proxy to avoid CORS)
// false = use local server's own processing
let useMCP = true;

// Agent mode - LLM formats results (uses OPENAI_API_KEY from server .env)
let useAgent = true;  // DEFAULT ON

export function setUseMCP(value: boolean) {
  useMCP = value;
}

export function getUseMCP(): boolean {
  return useMCP;
}

export function setUseAgent(value: boolean) {
  useAgent = value;
}

export function getUseAgent(): boolean {
  return useAgent;
}

// Store GitHub token in memory
let githubToken: string | null = null;

// Store MCP repo_id after indexing
let mcpRepoId: string | null = null;

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

  if (useMCP) {
    // Use MCP server via local proxy
    onProgress?.('Connecting to MCP server...', 20);
    
    // MCP server expects URL without .git suffix
    const repoUrl = `https://github.com/${repoName}`;
    const res = await fetch(`${API_URL}/mcp/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl, token })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'MCP indexing failed');
    }

    const result = await res.json();
    console.log('[MCP] Index result:', result);
    
    // Handle different response formats
    mcpRepoId = result.repo_id || result.repoId || result.id || repoName;
    console.log('[MCP] Using repo_id:', mcpRepoId);
    
    onProgress?.('MCP indexing complete!', 100);
    
    // Return entity count for UI display (MCP stores actual entities)
    const entityCount = result.entities || 0;
    return Array(entityCount).fill(null).map((_, i) => ({
      name: `Entity ${i + 1}`,
      type: 'function' as const,
      complexity: 1,
      lines: 0,
      file: ''
    }));
  }

  // Use local processing
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
// Ask Question (with Agent mode for LLM-formatted answers)
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
  if (useMCP) {
    const repoId = mcpRepoId || repoName;
    if (!repoId) {
      throw new Error('Repository not indexed via MCP. Please analyze it first.');
    }
    
    // If agent mode is ON, use the agent endpoint (LLM formats results)
    if (useAgent) {
      console.log('[Agent] Using LLM agent mode');
      
      const res = await fetch(`${API_URL}/agent/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId, question, maxTokens })
      });

      if (!res.ok) {
        const data = await res.json();
        // Fall back to direct MCP if agent fails
        console.log('[Agent] Failed, falling back to direct MCP:', data.error);
      } else {
        const result = await res.json();
        return {
          answer: result.answer,
          context: result.context,
          queryType: result.queryType || 'agent',
          confidence: result.confidence || 0.9,
          tokens: result.tokens || 0,
          searchTimeMs: result.searchTimeMs || 0,
          entities: result.entities || []
        };
      }
    }
    
    // Direct MCP search (no LLM)
    console.log('[MCP] Searching with repo_id:', repoId);

    const res = await fetch(`${API_URL}/mcp/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoId, query: question, maxTokens })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'MCP search failed');
    }

    const result = await res.json();
    console.log('[MCP] Search result:', result);
    
    const results = result.results || [];
    const context = result.context || '';
    
    // Format response
    const entityNames = results.map((r: any) => r.file?.split('/').pop() || r.name);
    
    let answer: string;
    if (results.length > 0) {
      const snippetList = results.slice(0, 5).map((r: any) => 
        `• **${r.file?.split('/').pop()}** (lines ${r.startLine}-${r.endLine})`
      ).join('\n');
      
      answer = `Found ${results.length} relevant code snippets:\n\n${snippetList}\n\n**Query Analysis:**\n- Type: ${result.query_analysis?.type || 'simple'}\n- Confidence: ${Math.round((result.query_analysis?.confidence || 0.8) * 100)}%\n${result.query_analysis?.reason ? `- Reason: ${result.query_analysis.reason}` : ''}\n\n---\n\n*${result.message || 'Code context available below.'}*`;
    } else {
      answer = "I couldn't find relevant code for this question.";
    }

    return {
      answer,
      context,
      queryType: result.query_analysis?.type || 'simple',
      confidence: result.query_analysis?.confidence || 0.8,
      tokens: result.tokens || 0,
      searchTimeMs: 0,
      entities: entityNames
    };
  }

  // Use local processing
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
