// ============================================================================
// FILE: mcp/tools/search_code.ts
// PURPOSE: Semantic code search with embeddings and fallback to keyword search
// ============================================================================

import { Tool, SchemaConstraint, Optional } from '@leanmcp/core';
import { store } from '../store.js';
import { getDirectDependencies, getDirectDependents } from '../../src/graph.js';
import { CodeEntity } from '../../src/types.js';
import { 
  classifyQuery, 
  getSearchStrategy,
  QueryAnalysis 
} from '../../src/retrieval/classifier.js';
import { compressionPipeline } from '../../src/compression/index.js';
import { semanticSearch, SimilarityResult } from '../../src/embeddings.js';
import {
  rankEntities,
  addDependencyContext,
  deduplicateResults,
  RankedEntity
} from '../helpers/ranking.js';
import {
  formatSnippets,
  calculateStats,
  CodeSnippet,
  SearchStats
} from '../helpers/snippets.js';
import { enforceTokenBudget } from '../helpers/tokens.js';

// Minimum similarity score threshold for semantic search
const MIN_SIMILARITY_SCORE = 0.35;

/**
 * Input schema for search_code tool
 */
class SearchCodeInput {
  @SchemaConstraint({
    description: 'Repository ID returned from index_repo'
  })
  repo_id!: string;

  @SchemaConstraint({
    description: 'Natural language query (e.g., "authentication flow", "error handling", "how does login work")'
  })
  query!: string;

  @Optional()
  @SchemaConstraint({
    description: 'Maximum number of results to return',
    default: 10,
    minimum: 1,
    maximum: 50
  })
  k?: number;

  @Optional()
  @SchemaConstraint({
    description: 'Maximum tokens to return (default: 2000)',
    default: 2000,
    minimum: 100,
    maximum: 10000
  })
  token_budget?: number;

  @Optional()
  @SchemaConstraint({
    description: 'Include dependency expansion (functions called and callers)',
    default: true
  })
  expand_deps?: boolean;

  @Optional()
  @SchemaConstraint({
    description: 'Enable code compression/slicing to fit more results in token budget',
    default: false
  })
  compress?: boolean;
}

/**
 * SearchCodeService - Semantic search with embeddings + fallback to keyword
 * 
 * Pipeline:
 * 1. Classify query to understand intent
 * 2. If embeddings available: semantic search with similarity scores
 * 3. If no embeddings: fallback to keyword search
 * 4. Filter by minimum score threshold (semantic) or return "no results" (keyword)
 * 5. Expand dependencies, apply compression, enforce token budget
 */
export class SearchCodeService {
  @Tool({
    description: 'Search the indexed codebase using semantic similarity (with OpenAI embeddings) or keyword matching. Returns ranked results with similarity scores. Will report "no relevant code found" if the query does not match the codebase content.',
    inputClass: SearchCodeInput
  })
  async search_code(input: SearchCodeInput) {
    try {
      const repo = store.get(input.repo_id);
      
      if (!repo) {
        // Handle DEMO_MODE
        if (process.env.DEMO_MODE === 'true') {
          return this.getDemoResponse(input);
        }
        
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'error',
              error: `Repository not found: ${input.repo_id}`,
              hint: 'Call index_repo first to index the repository',
              available_repos: store.list()
            }, null, 2)
          }],
          isError: true
        };
      }

      // Step 0: Classify the query to understand intent
      const queryAnalysis = classifyQuery(input.query);
      const searchStrategy = getSearchStrategy(queryAnalysis);

      // Use strategy-recommended values as defaults, allow user override
      const k = input.k ?? Math.min(searchStrategy.topK, 10);
      const tokenBudget = input.token_budget ?? 2000;
      const expandDeps = input.expand_deps ?? (searchStrategy.includeCallers || searchStrategy.includeCallees);
      const useCompression = input.compress ?? false;

      // Determine search mode based on whether embeddings are available
      const hasEmbeddings = repo.vectorStore !== null;
      const searchMode = hasEmbeddings ? 'semantic' : 'keyword';

      let ranked: RankedEntity[] = [];
      let topScores: Array<{ name: string; score: number }> = [];
      let rawMatchCount = 0;

      if (hasEmbeddings && repo.vectorStore) {
        // ===== SEMANTIC SEARCH =====
        console.log(`🔎 Semantic search: "${input.query}"`);
        
        const searchResult = await semanticSearch(
          input.query,
          repo.vectorStore,
          repo.graph,
          {
            topK: Math.max(k * 3, 15), // Get more candidates for filtering
            expandDepth: searchStrategy.graphDepth,
            model: 'openai',
            sessionId: repo.sessionId  // Use session ID from indexing for observability
          }
        );

        rawMatchCount = searchResult.matches.length;
        
        // Extract top 5 scores for reporting
        topScores = searchResult.matches.slice(0, 5).map(m => ({
          name: m.entity.entityName,
          score: Math.round(m.score * 1000) / 1000
        }));

        // Check if top score meets threshold
        const topScore = searchResult.matches[0]?.score ?? 0;
        
        if (topScore < MIN_SIMILARITY_SCORE) {
          // No relevant results found
          console.log(`   ⚠️  No relevant code found (top score: ${topScore.toFixed(2)})`);
          
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'no_results',
                query: input.query,
                repo_id: input.repo_id,
                search_mode: 'semantic',
                query_analysis: {
                  type: queryAnalysis.type,
                  confidence: Math.round(queryAnalysis.confidence * 100) / 100,
                  targets: queryAnalysis.targets,
                  reason: queryAnalysis.reason
                },
                search_stats: {
                  raw_matches: rawMatchCount,
                  top_scores: topScores,
                  threshold: MIN_SIMILARITY_SCORE,
                  top_score: Math.round(topScore * 1000) / 1000
                },
                message: `No relevant code found for "${input.query}". The repository does not appear to contain code related to this query.`,
                suggestion: 'Try a different query that matches the codebase content, or use resolve_symbol for exact name lookup.'
              }, null, 2)
            }]
          };
        }

        // Filter matches above threshold and convert to RankedEntity format
        const validMatches = searchResult.matches.filter(m => m.score >= MIN_SIMILARITY_SCORE);
        
        for (const match of validMatches) {
          const entity = repo.graph.entities.get(match.entity.entityId);
          if (entity) {
            ranked.push({
              entity,
              score: match.score * 100, // Scale to 0-100 for consistency
              reason: `Semantic similarity: ${(match.score * 100).toFixed(1)}%`
            });
          }
        }

        console.log(`   Found ${ranked.length} relevant matches (threshold: ${MIN_SIMILARITY_SCORE})`);

      } else {
        // ===== KEYWORD SEARCH (fallback) =====
        console.log(`🔎 Keyword search: "${input.query}" (no embeddings)`);
        
        ranked = rankEntities(input.query, repo.entities, queryAnalysis.targets);
        rawMatchCount = ranked.length;

        // For keyword search, check if we have meaningful matches
        if (ranked.length === 0) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'no_results',
                query: input.query,
                repo_id: input.repo_id,
                search_mode: 'keyword',
                query_analysis: {
                  type: queryAnalysis.type,
                  confidence: Math.round(queryAnalysis.confidence * 100) / 100,
                  targets: queryAnalysis.targets,
                  reason: queryAnalysis.reason
                },
                message: `No matching code found for "${input.query}".`,
                suggestion: 'Try broader search terms or check the repository was indexed correctly. Set LEANMCP_API_KEY or OPENAI_API_KEY for semantic search.'
              }, null, 2)
            }]
          };
        }
      }

      // Step 2: Expand with dependencies based on strategy
      if (expandDeps && ranked.length > 0) {
        const dependencyMap = new Map<string, CodeEntity[]>();
        const dependentMap = new Map<string, CodeEntity[]>();

        const topMatchCount = Math.min(5, ranked.length);
        for (const match of ranked.slice(0, topMatchCount)) {
          if (searchStrategy.includeCallees) {
            const deps = getDirectDependencies(repo.graph, match.entity.id);
            dependencyMap.set(match.entity.id, deps);
          }
          if (searchStrategy.includeCallers) {
            const dependents = getDirectDependents(repo.graph, match.entity.id);
            dependentMap.set(match.entity.id, dependents);
          }
        }

        ranked = addDependencyContext(ranked, dependencyMap, dependentMap);
      }

      // Step 3: Deduplicate
      ranked = deduplicateResults(ranked);

      // Step 4: Apply compression or standard token budget
      let finalResults: RankedEntity[];
      let totalTokens: number;
      let dropped: number;
      let compressionStats: Record<string, unknown> | null = null;

      if (useCompression && ranked.length > 0) {
        const entitiesForCompression = ranked.slice(0, k * 2).map(r => ({
          id: r.entity.id,
          name: r.entity.name,
          file: r.entity.file,
          code: r.entity.code,
          tokens: r.entity.tokens,
          score: r.score
        }));

        const compressed = await compressionPipeline(
          entitiesForCompression,
          input.query,
          tokenBudget
        );

        finalResults = compressed.entities.map(ce => {
          const original = ranked.find(r => r.entity.id === ce.id)!;
          return {
            ...original,
            entity: {
              ...original.entity,
              code: ce.slicedCode,
              tokens: ce.slicedTokens
            }
          };
        }).slice(0, k);

        totalTokens = compressed.stats.afterSlicing;
        dropped = ranked.length - compressed.entities.length;
        compressionStats = {
          original_tokens: compressed.stats.totalOriginalTokens,
          compressed_tokens: compressed.stats.afterSlicing,
          reduction: compressed.stats.slicingReduction
        };
      } else {
        const budgetResult = enforceTokenBudget(ranked, tokenBudget);
        finalResults = budgetResult.selected.slice(0, k);
        totalTokens = budgetResult.totalTokens;
        dropped = budgetResult.dropped;
      }

      // Step 5: Format output
      const snippets = formatSnippets(finalResults);
      const stats = calculateStats(repo.entities, finalResults);

      // Build response
      const response: Record<string, unknown> = {
        status: 'success',
        query: input.query,
        repo_id: input.repo_id,
        search_mode: searchMode,
        query_analysis: {
          type: queryAnalysis.type,
          confidence: Math.round(queryAnalysis.confidence * 100) / 100,
          targets: queryAnalysis.targets,
          reason: queryAnalysis.reason
        },
        ...(hasEmbeddings && {
          search_stats: {
            raw_matches: rawMatchCount,
            top_scores: topScores,
            threshold: MIN_SIMILARITY_SCORE
          }
        }),
        snippets,
        stats: {
          ...stats,
          token_budget: tokenBudget,
          tokens_used: totalTokens,
          results_dropped_for_budget: dropped,
          ...(compressionStats && { compression: compressionStats })
        },
        message: `Found ${finalResults.length} relevant code snippets (${stats.reduction_percent}% token reduction)`
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error) {
      if (process.env.DEMO_MODE === 'true') {
        return this.getDemoResponse(input);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  /**
   * getDemoResponse - Return stub response for demo mode
   */
  private getDemoResponse(input: SearchCodeInput) {
    const demoAnalysis = classifyQuery(input.query);

    const demoSnippets: CodeSnippet[] = [
      {
        path: 'src/auth/login.ts',
        startLine: 15,
        endLine: 35,
        code: `async function authenticateUser(email: string, password: string): Promise<User> {
  const user = await db.users.findByEmail(email);
  if (!user) throw new AuthError('User not found');
  
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AuthError('Invalid password');
  
  return user;
}`,
        reason: 'Semantic similarity: 78.5%'
      },
      {
        path: 'src/auth/session.ts',
        startLine: 42,
        endLine: 58,
        code: `function createSession(user: User): Session {
  const token = generateToken(user.id);
  return {
    token,
    userId: user.id,
    expiresAt: Date.now() + SESSION_DURATION
  };
}`,
        reason: 'Semantic similarity: 65.2%'
      }
    ];

    const demoStats: SearchStats = {
      baseline_tokens: 45000,
      returned_tokens: 850,
      reduction_percent: 98,
      entities_searched: 234,
      entities_returned: 2
    };

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: 'demo_mode',
          query: input.query,
          repo_id: input.repo_id,
          search_mode: 'semantic',
          query_analysis: {
            type: demoAnalysis.type,
            confidence: demoAnalysis.confidence,
            targets: demoAnalysis.targets,
            reason: demoAnalysis.reason
          },
          search_stats: {
            raw_matches: 15,
            top_scores: [
              { name: 'authenticateUser', score: 0.785 },
              { name: 'createSession', score: 0.652 },
              { name: 'validateToken', score: 0.543 }
            ],
            threshold: MIN_SIMILARITY_SCORE
          },
          snippets: demoSnippets,
          stats: demoStats,
          message: 'Demo mode - returning example response'
        }, null, 2)
      }]
    };
  }
}
