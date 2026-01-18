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
