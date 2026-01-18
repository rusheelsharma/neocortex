// ============================================================================
// FILE: src/server.ts
// PURPOSE: Express server exposing Neocortex API endpoints
// ============================================================================

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { cloneRepository, getSourceFiles } from './clone.js';
import { parseFile } from './parser.js';
import { buildDependencyGraph } from './graph.js';
import { buildSemanticIndex, semanticSearch, VectorStore, SemanticIndex } from './embeddings.js';
import { classifyQuery, getSearchStrategy } from './retrieval/classifier.js';
import { improvedSearch } from './retrieval/search.js';
import { selectWithinBudget } from './retrieval/budget.js';
import { CodeEntity } from './types.js';

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================================
// In-memory store for indexed repos
// ============================================================================

interface IndexedRepo {
  entities: CodeEntity[];
  graph: ReturnType<typeof buildDependencyGraph>;
  vectorStore: VectorStore;
  repoPath: string;
}

const indexedRepos = new Map<string, IndexedRepo>();

// ============================================================================
// API Endpoints
// ============================================================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Validate GitHub token and get user info
app.post('/api/auth/validate', async (req, res) => {
  try {
    const { token } = req.body;
    
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Neocortex'
      }
    });

    if (!userRes.ok) {
      if (userRes.status === 401) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      return res.status(userRes.status).json({ error: `GitHub API error: ${userRes.status}` });
    }

    const data = await userRes.json();
    res.json({
      name: data.name || data.login,
      avatar: data.login.charAt(0).toUpperCase(),
      login: data.login
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Fetch user repos
app.post('/api/repos', async (req, res) => {
  try {
    const { token } = req.body;
    
    const reposRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Neocortex'
      }
    });

    if (!reposRes.ok) {
      return res.status(reposRes.status).json({ error: 'Failed to fetch repos' });
    }

    const repos = await reposRes.json();
    res.json(repos.map((r: any) => ({
      name: r.full_name,
      desc: r.description || 'No description',
      lang: r.language || 'Unknown',
      stars: r.stargazers_count,
      updated: new Date(r.updated_at).toLocaleDateString(),
      private: r.private
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze repository
app.post('/api/analyze', async (req, res) => {
  try {
    const { repoName, token } = req.body;
    const repoUrl = `https://github.com/${repoName}.git`;

    console.log(`[Analyze] Starting: ${repoName}`);

    // Step 1: Clone
    console.log('[Analyze] Cloning...');
    const repoPath = await cloneRepository(repoUrl, token || undefined);

    // Step 2: Get files
    console.log('[Analyze] Scanning files...');
    const files = await getSourceFiles(
      repoPath,
      ['.ts', '.tsx', '.js', '.jsx'],
      ['node_modules', 'dist', 'build', '.git', '*.test.ts', '*.spec.ts', '__tests__', '*.d.ts']
    );

    // Step 3: Parse
    console.log(`[Analyze] Parsing ${files.length} files...`);
    const entities: CodeEntity[] = [];
    for (const file of files) {
      try {
        const parsed = await parseFile(file);
        entities.push(...parsed);
      } catch (e) {
        // Skip unparseable files
      }
    }

    // Step 4: Build semantic index
    console.log('[Analyze] Building semantic index...');
    const semanticIndex: SemanticIndex = await buildSemanticIndex(
      entities,
      { model: 'openai', batchSize: 20, includeCode: false, includeDependencyContext: true, maxTokens: 512 }
    );

    // Step 5: Store in memory
    indexedRepos.set(repoName, {
      entities,
      graph: semanticIndex.graph,
      vectorStore: semanticIndex.store,
      repoPath
    });

    console.log(`[Analyze] Complete: ${entities.length} entities`);

    // Return entity info
    res.json(entities.map(e => ({
      name: e.name,
      type: e.type,
      complexity: e.complexity,
      lines: e.endLine - e.startLine + 1,
      file: e.file.replace(repoPath, '').replace(/^\//, '')
    })));
  } catch (error: any) {
    console.error('[Analyze] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ask question
app.post('/api/ask', async (req, res) => {
  try {
    const { repoName, question, maxTokens = 2000 } = req.body;
    const startTime = Date.now();

    const indexed = indexedRepos.get(repoName);
    if (!indexed) {
      return res.status(400).json({ error: 'Repository not indexed. Please analyze it first.' });
    }

    const { entities, graph, vectorStore } = indexed;

    // Step 1: Classify query
    const analysis = classifyQuery(question);
    const strategy = getSearchStrategy(analysis);

    // Step 2: Semantic search
    const rawResults = await semanticSearch(question, vectorStore, graph, {
      topK: strategy.topK
    });

    // Step 2.5: Check for low relevance (no matching code)
    // OpenAI embeddings score 0.2-0.4 for relevant code, below 0.20 means no match
    const topScore = rawResults.matches[0]?.score ?? 0;
    console.log(`[Ask] Top semantic score: ${topScore.toFixed(3)}`);
    
    if (topScore < 0.20) {
      // No relevant code found in repository
      const searchTimeMs = Date.now() - startTime;
      return res.json({
        answer: `No relevant code found for "${question}".\n\nThe repository doesn't appear to contain code related to this topic. Try asking about specific functions or features that exist in the codebase.`,
        context: '',
        queryType: analysis.type,
        confidence: analysis.confidence,
        tokens: 0,
        searchTimeMs,
        entities: [],
        lowRelevance: true,
        topScore
      });
    }

    // Step 3: Build scores map
    const scores = new Map<string, number>();
    for (const match of rawResults.matches) {
      scores.set(match.entity.entityId, match.score);
    }

    // Step 4: Improved search
    const improved = improvedSearch(question, entities, graph, scores, {
      topK: strategy.topK,
      minScore: strategy.minScore,
      keywordBoost: strategy.keywordBoost,
      graphDepth: analysis.depth
    });

    // Step 5: Budget selection
    const ranked = improved.map(r => r.entity);
    const { selected, totalTokens, context } = selectWithinBudget(ranked, maxTokens);

    const searchTimeMs = Date.now() - startTime;

    // Format answer
    const entityNames = selected.map(e => e.name);
    const answer = formatAnswer(question, selected, analysis);

    res.json({
      answer,
      context,
      queryType: analysis.type,
      confidence: analysis.confidence,
      tokens: totalTokens,
      searchTimeMs,
      entities: entityNames
    });
  } catch (error: any) {
    console.error('[Ask] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if repo is indexed (use query param for repo names with slashes)
app.get('/api/indexed', (req, res) => {
  const repoName = req.query.repo as string;
  if (!repoName) {
    return res.status(400).json({ error: 'Missing repo query parameter' });
  }
  res.json({ indexed: indexedRepos.has(repoName) });
});

// ============================================================================
// MCP Server Proxy - Calls deployed MCP server (avoids browser CORS issues)
// ============================================================================

const MCP_SERVER_URL = 'https://neocortex-mcp.leanmcp.app';

// Helper to call MCP tools (supports SSE responses)
async function callMCPTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
  const response = await fetch(`${MCP_SERVER_URL}/mcp`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',  // MCP requires both!
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

  const contentType = response.headers.get('content-type') || '';
  
  // Handle SSE response
  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    // Parse SSE format: "data: {...}\n\n"
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.result) {
            return parseToolResult(data.result);
          }
          if (data.error) {
            throw new Error(data.error.message || 'MCP tool call failed');
          }
        } catch (e) {
          // Continue to next line
        }
      }
    }
    throw new Error('No valid response in SSE stream');
  }

  // Handle JSON response
  if (!response.ok) {
    const text = await response.text();
    console.error(`[MCP] Error ${response.status}:`, text);
    throw new Error(`MCP server error: ${response.status}`);
  }

  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error.message || 'MCP tool call failed');
  }

  return parseToolResult(result.result);
}

// Parse MCP tool result from various formats (handles double-nested JSON)
function parseToolResult(result: any): any {
  if (!result) return result;
  
  // Preserve isError flag
  const isError = result.isError;
  
  // Recursively extract from { content: [{ type: "text", text: "..." }] } format
  let current = result;
  let depth = 0;
  const maxDepth = 5; // Prevent infinite loops
  
  while (depth < maxDepth) {
    // Check if current has content array with text
    if (current.content && Array.isArray(current.content)) {
      const textContent = current.content.find((c: any) => c.type === 'text' && c.text);
      if (textContent?.text) {
        try {
          const parsed = JSON.parse(textContent.text);
          current = parsed;
          depth++;
          continue; // Keep parsing if still nested
        } catch {
          break; // Can't parse further
        }
      }
    }
    break; // No more nesting
  }
  
  // Now current should have the actual data
  console.log('[MCP] parseToolResult final (depth=' + depth + '):', current);
  
  // Preserve isError in result
  if (isError && typeof current === 'object') {
    current.isError = true;
  }
  
  return current;
}

// MCP Health check
app.get('/api/mcp/health', async (req, res) => {
  try {
    const result = await callMCPTool('ping');
    res.json({ status: 'ok', mcp: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// MCP Index repo
app.post('/api/mcp/index', async (req, res) => {
  try {
    const { repoUrl, token } = req.body;
    console.log(`[MCP] Indexing: ${repoUrl}`);
    
    const result = await callMCPTool('index_repo', {
      repo_url: repoUrl,
      token: token || undefined,
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      exclude_patterns: ['node_modules', 'dist', 'build', '.git']
    });
    
    console.log(`[MCP] Index complete - parsed result:`, result);
    
    // Check if MCP returned an error
    const hasError = result?.isError || result?.status === 'error' || (typeof result?.error === 'string' && result.error.length > 0);
    if (hasError) {
      const errorMsg = result?.error || result?.message || result?.hint || 'MCP indexing failed';
      console.error(`[MCP] Index failed:`, errorMsg);
      return res.status(500).json({ 
        error: errorMsg,
        hint: result?.hint || 'Check if the repository is public and accessible'
      });
    }
    
    // Extract repo_id from the parsed result
    const repoId = result?.repo_id || result?.repoId || result?.id;
    if (!repoId) {
      console.error(`[MCP] No repo_id in response:`, result);
      return res.status(500).json({ error: 'MCP server did not return a repo_id' });
    }
    
    // Return the proper response
    const response = {
      repo_id: repoId,
      entities: result?.entities || result?.entity_count || 0,
      files: result?.files || result?.file_count || 0,
      message: result?.message || 'Indexed successfully',
      has_embeddings: result?.has_embeddings || false
    };
    
    console.log(`[MCP] Returning:`, response);
    res.json(response);
  } catch (error: any) {
    console.error('[MCP] Index error:', error);
    res.status(500).json({ error: error.message });
  }
});

// MCP Search code
app.post('/api/mcp/search', async (req, res) => {
  try {
    const { repoId, query, maxTokens = 2000 } = req.body;
    console.log(`[MCP] Searching: "${query}" in ${repoId}`);
    
    const result = await callMCPTool('search_code', {
      repo_id: repoId,
      query,
      token_budget: maxTokens,
      expand_deps: true,
      compress: true
    });
    
    // MCP returns 'snippets', normalize to 'results' for frontend
    const snippets = result?.snippets || result?.results || [];
    console.log(`[MCP] Search complete:`, snippets.length, 'results');
    
    // Transform snippets to results format
    const results = snippets.map((s: any) => ({
      name: s.path?.split('/').pop() || 'unknown',
      type: 'snippet',
      file: s.path || '',
      code: s.code || '',
      score: s.score || 0.5,
      startLine: s.startLine,
      endLine: s.endLine,
      reason: s.reason
    }));
    
    // Build context from all code snippets
    const context = snippets.map((s: any) => 
      `// File: ${s.path} (lines ${s.startLine}-${s.endLine})\n${s.code}`
    ).join('\n\n');
    
    res.json({
      results,
      context,
      tokens: result?.stats?.tokens_used || 0,
      stats: result?.stats,
      query_analysis: result?.query_analysis,
      message: result?.message
    });
  } catch (error: any) {
    console.error('[MCP] Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// MCP Resolve symbol
app.post('/api/mcp/resolve', async (req, res) => {
  try {
    const { repoId, symbol } = req.body;
    const result = await callMCPTool('resolve_symbol', {
      repo_id: repoId,
      symbol
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// MCP Get snippet
app.post('/api/mcp/snippet', async (req, res) => {
  try {
    const { repoId, filePath, startLine, endLine, contextLines } = req.body;
    const result = await callMCPTool('get_snippet', {
      repo_id: repoId,
      file_path: filePath,
      start_line: startLine,
      end_line: endLine,
      context_lines: contextLines
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// Agent Endpoint - LLM formats search results (uses OPENAI_API_KEY from .env)
// ============================================================================

app.post('/api/agent/ask', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { repoId, question, maxTokens = 2000 } = req.body;
    
    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ 
        error: 'OPENAI_API_KEY not set in .env',
        hint: 'Add OPENAI_API_KEY=sk-... to your .env file'
      });
    }
    
    console.log(`[Agent] Question: "${question}"`);
    
    // Step 1: Get code snippets from MCP
    const mcpResult = await callMCPTool('search_code', {
      repo_id: repoId,
      query: question,
      token_budget: maxTokens,
      expand_deps: true,
      compress: true
    });
    
    const snippets = mcpResult?.snippets || [];
    console.log(`[Agent] MCP returned ${snippets.length} snippets`);
    
    if (snippets.length === 0) {
      return res.json({
        answer: "I couldn't find relevant code for this question.",
        context: '',
        queryType: 'agent',
        confidence: 0.5,
        tokens: 0,
        searchTimeMs: Date.now() - startTime,
        entities: []
      });
    }
    
    // Build context from snippets
    const context = snippets.map((s: any) => 
      `// File: ${s.path} (lines ${s.startLine}-${s.endLine})\n${s.code}`
    ).join('\n\n');
    
    // Step 2: Use LLM to format answer
    console.log(`[Agent] Calling GPT-4o-mini...`);
    
    const llmResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a code analysis assistant. Given code snippets, explain how they answer the user's question. Be concise (2-3 paragraphs max). Reference specific files and functions.`
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nCode snippets:\n${context.slice(0, 6000)}`
          }
        ],
        max_tokens: 500,
        temperature: 0
      })
    });
    
    if (!llmResponse.ok) {
      const error = await llmResponse.text();
      console.error('[Agent] LLM error:', error);
      throw new Error('LLM call failed');
    }
    
    const llmData = await llmResponse.json();
    const answer = llmData.choices[0]?.message?.content || 'Failed to generate explanation.';
    
    console.log(`[Agent] Complete in ${Date.now() - startTime}ms`);
    
    res.json({
      answer,
      context,
      queryType: mcpResult?.query_analysis?.type || 'agent',
      confidence: mcpResult?.query_analysis?.confidence || 0.9,
      tokens: mcpResult?.stats?.tokens_used || 0,
      searchTimeMs: Date.now() - startTime,
      entities: snippets.map((s: any) => s.path?.split('/').pop() || 'unknown')
    });
    
  } catch (error: any) {
    console.error('[Agent] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if agent is available (has OpenAI key)
app.get('/api/agent/status', (req, res) => {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.json({ 
    available: hasKey,
    model: 'gpt-4o-mini'
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

function formatAnswer(
  question: string,
  entities: CodeEntity[],
  analysis: ReturnType<typeof classifyQuery>
): string {
  if (entities.length === 0) {
    return "I couldn't find relevant code for this question. Try rephrasing or asking about specific functions.";
  }

  const entityList = entities.slice(0, 5).map(e => 
    `• **${e.name}** (${e.type}) - ${e.file.split('/').pop()}`
  ).join('\n');
  
  let intro = '';
  
  switch (analysis.type) {
    case 'simple':
      intro = `Here's what I found about "${analysis.targets[0] || 'this'}":`;
      break;
    case 'multi-hop':
      intro = `Here's the connection flow I traced:`;
      break;
    case 'architectural':
      intro = `Here are the main components related to your question:`;
      break;
    case 'comparative':
      intro = `Here are the entities to compare:`;
      break;
    case 'debugging':
      intro = `Here are the relevant functions that might be involved:`;
      break;
    case 'usage':
      intro = `Here's how this is used:`;
      break;
    default:
      intro = `Found ${entities.length} relevant code entities:`;
  }

  return `${intro}

${entityList}

${entities.length > 5 ? `\n...and ${entities.length - 5} more entities.` : ''}

**Query Analysis:**
- Type: ${analysis.type}
- Confidence: ${Math.round(analysis.confidence * 100)}%
- Graph depth: ${analysis.depth}
${analysis.reason ? `- Reason: ${analysis.reason}` : ''}

---

*The full code context is available below. You can copy it into any LLM for a detailed explanation.*`;
}

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🧠 Neocortex API Server running on http://localhost:${PORT}\n`);
});
