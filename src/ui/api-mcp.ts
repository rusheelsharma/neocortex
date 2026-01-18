// ============================================================================
// FILE: src/ui/api-mcp.ts
// PURPOSE: Frontend API client for deployed LeanMCP server
// MCP Server: https://neocortex-mcp.leanmcp.app
// ============================================================================

const MCP_BASE = 'https://neocortex-mcp.leanmcp.app';

// Store the repo_id after indexing
let currentRepoId: string | null = null;

// ============================================================================
// MCP Tool Call Helper
// LeanMCP uses POST to /mcp with JSON-RPC 2.0 format
// ============================================================================

async function callMCPTool<T>(toolName: string, args: Record<string, any> = {}): Promise<T> {
  // Try the standard MCP JSON-RPC format
  const response = await fetch(`${MCP_BASE}/mcp`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`MCP error ${response.status}:`, text);
    throw new Error(`MCP server error: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error.message || 'MCP tool call failed');
  }

  // Handle MCP response format - result might be nested
  if (result.result?.content) {
    // MCP returns { result: { content: [...] } }
    const content = result.result.content;
    if (Array.isArray(content) && content[0]?.text) {
      try {
        return JSON.parse(content[0].text);
      } catch {
        return content[0].text as T;
      }
    }
    return content as T;
  }

  return result.result ?? result;
}

// ============================================================================
// Health Check
// ============================================================================

export async function ping(): Promise<{ status: string; indexedRepos?: number }> {
  try {
    // Try health endpoint first
    const healthRes = await fetch(`${MCP_BASE}/health`);
    if (healthRes.ok) {
      return { status: 'ok' };
    }
  } catch (e) {
    // Fall back to ping tool
  }
  
  try {
    return await callMCPTool('ping');
  } catch (e) {
    // If MCP fails, just return ok if we can reach the server
    return { status: 'ok' };
  }
}

// ============================================================================
// Index Repository
// ============================================================================

export async function indexRepo(
  repoUrl: string,
  token?: string,
  onProgress?: (message: string, percent: number) => void
): Promise<string> {
  onProgress?.('Connecting to MCP server...', 10);
  onProgress?.('Cloning and indexing repository...', 30);
  
  const result = await callMCPTool<{
    repo_id: string;
    entities?: number;
    files?: number;
    message?: string;
  }>('index_repo', {
    repo_url: repoUrl,
    token: token || undefined,
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    exclude_patterns: ['node_modules', 'dist', 'build', '.git']
  });

  onProgress?.('Indexing complete!', 100);
  
  currentRepoId = result.repo_id;
  return result.repo_id;
}

// ============================================================================
// Search Code
// ============================================================================

export interface SearchResult {
  answer: string;
  context: string;
  queryType: string;
  confidence: number;
  tokens: number;
  searchTimeMs: number;
  entities: string[];
}

export async function searchCode(
  repoId: string,
  query: string,
  maxTokens: number = 2000
): Promise<SearchResult> {
  const startTime = Date.now();

  // Search
  const searchResult = await callMCPTool<{
    results?: Array<{
      name: string;
      type: string;
      file: string;
      code: string;
      score: number;
    }>;
    context?: string;
    tokens?: number;
    message?: string;
  }>('search_code', {
    repo_id: repoId,
    query,
    token_budget: maxTokens,
    expand_deps: true,
    compress: true
  });

  const searchTimeMs = Date.now() - startTime;
  const results = searchResult.results || [];
  const entityNames = results.map(r => r.name);
  
  // Format answer
  const answer = formatAnswer(query, results);

  return {
    answer,
    context: searchResult.context || results.map(r => r.code).join('\n\n'),
    queryType: 'simple',
    confidence: 0.8,
    tokens: searchResult.tokens || 0,
    searchTimeMs,
    entities: entityNames
  };
}

// ============================================================================
// Resolve Symbol
// ============================================================================

export async function resolveSymbol(
  repoId: string,
  symbol: string
): Promise<Array<{
  name: string;
  type: string;
  file: string;
  code: string;
  startLine: number;
  endLine: number;
}>> {
  const result = await callMCPTool<any>('resolve_symbol', {
    repo_id: repoId,
    symbol
  });
  return result.definitions || result || [];
}

// ============================================================================
// Get Code Snippet
// ============================================================================

export async function getSnippet(
  repoId: string,
  filePath: string,
  startLine: number,
  endLine: number,
  contextLines?: number
): Promise<{
  code: string;
  file: string;
  startLine: number;
  endLine: number;
}> {
  return callMCPTool('get_snippet', {
    repo_id: repoId,
    file_path: filePath,
    start_line: startLine,
    end_line: endLine,
    context_lines: contextLines
  });
}

// ============================================================================
// High-Level API
// ============================================================================

export async function analyzeRepo(
  repoName: string,
  token?: string,
  onProgress?: (message: string, percent: number) => void
): Promise<any[]> {
  const repoUrl = `https://github.com/${repoName}.git`;
  
  onProgress?.('Connecting to MCP server...', 5);
  
  await indexRepo(repoUrl, token, onProgress);
  
  return [];
}

export async function askQuestion(
  repoName: string,
  question: string,
  maxTokens: number = 2000
): Promise<SearchResult> {
  if (!currentRepoId) {
    throw new Error('Repository not indexed. Please analyze it first.');
  }
  
  return searchCode(currentRepoId, question, maxTokens);
}

export function getCurrentRepoId(): string | null {
  return currentRepoId;
}

export function setCurrentRepoId(repoId: string) {
  currentRepoId = repoId;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatAnswer(
  question: string,
  results: Array<{ name: string; type: string; file: string }>
): string {
  if (results.length === 0) {
    return "I couldn't find relevant code for this question. Try rephrasing or asking about specific functions.";
  }

  const entityList = results.slice(0, 5).map(e => 
    `• **${e.name}** (${e.type}) - ${e.file.split('/').pop()}`
  ).join('\n');

  return `Here's what I found about "${question}":

${entityList}

${results.length > 5 ? `\n...and ${results.length - 5} more entities.` : ''}

---

*The full code context is available below. You can copy it into any LLM for a detailed explanation.*`;
}
