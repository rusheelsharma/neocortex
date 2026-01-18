// ============================================================================
// FILE: src/retrieval/search.ts
// PURPOSE: Improved code retrieval combining semantic search, keyword boosting,
//          and graph-based filtering
// ============================================================================

import { CodeEntity } from '../types.js';
import { DependencyGraph, expandDependencies } from '../graph.js';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export interface SearchResult {
  entity: CodeEntity;
  score: number;
  matchType: 'semantic' | 'keyword' | 'graph';
}

export interface SearchOptions {
  topK?: number;           // Final results count (default: 10)
  candidatePool?: number;  // Initial semantic search pool (default: 30)
  keywordBoost?: number;   // Boost for keyword matches (default: 0.2)
  graphDepth?: number;     // Dependency expansion depth (default: 1)
  minScore?: number;       // Minimum similarity threshold (default: 0.15)
}

// ----------------------------------------------------------------------------
// KEYWORD SYNONYMS
// ----------------------------------------------------------------------------

const SYNONYMS: Record<string, string[]> = {
  auth: ['auth', 'login', 'signin', 'signout', 'logout', 'session', 'token', 'password', 'credential', 'user'],
  database: ['database', 'db', 'query', 'sql', 'mongo', 'postgres', 'mysql', 'storage'],
  api: ['api', 'endpoint', 'route', 'request', 'response', 'fetch', 'http', 'rest'],
  error: ['error', 'exception', 'catch', 'throw', 'handle', 'fail'],
  test: ['test', 'spec', 'mock', 'assert', 'expect', 'jest', 'mocha'],
};

const GENERIC_NAMES = new Set(['get', 'set', 'run', 'init', 'handle', 'on', 'do', 'make', 'create']);

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * extractKeywords - Extract keywords from query with synonym expansion
 */
function extractKeywords(query: string): string[] {
  const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const keywords = new Set<string>();

  for (const word of words) {
    keywords.add(word);
    // Check if word matches any synonym key or value
    for (const [key, synonyms] of Object.entries(SYNONYMS)) {
      if (word === key || synonyms.includes(word)) {
        synonyms.forEach(s => keywords.add(s));
      }
    }
  }

  return Array.from(keywords);
}

/**
 * hasKeywordMatch - Check if entity matches any keywords
 */
function hasKeywordMatch(entity: CodeEntity, keywords: string[]): boolean {
  const nameLower = entity.name.toLowerCase();
  const docLower = (entity.docstring || '').toLowerCase();
  const codeLower = entity.code.toLowerCase();

  for (const kw of keywords) {
    if (nameLower.includes(kw)) return true;
    if (docLower.includes(kw)) return true;
    if (codeLower.includes(kw)) return true;
  }
  return false;
}

/**
 * isGenericName - Check if entity name is too generic
 */
function isGenericName(name: string): boolean {
  const baseName = name.split('.').pop() || name;
  return GENERIC_NAMES.has(baseName.toLowerCase());
}

// ----------------------------------------------------------------------------
// MAIN SEARCH FUNCTION
// ----------------------------------------------------------------------------

/**
 * improvedSearch - Combine semantic search, keyword boosting, and graph filtering
 */
export function improvedSearch(
  query: string,
  entities: CodeEntity[],
  graph: DependencyGraph,
  semanticScores: Map<string, number>,
  options?: SearchOptions
): SearchResult[] {
  const topK = options?.topK ?? 10;
  const candidatePool = options?.candidatePool ?? 30;
  const keywordBoost = options?.keywordBoost ?? 0.2;
  const graphDepth = options?.graphDepth ?? 1;
  const minScore = options?.minScore ?? 0.15;  // OpenAI embeddings have lower scores

  // Edge case: empty query
  if (!query.trim()) return [];

  // 1. Get candidates from semantic scores
  const candidates: Array<{ entity: CodeEntity; score: number }> = [];
  for (const entity of entities) {
    const score = semanticScores.get(entity.id) ?? 0;
    if (score >= minScore) {
      candidates.push({ entity, score });
    }
  }

  // Sort by score descending, take candidate pool
  candidates.sort((a, b) => b.score - a.score);
  const pooledCandidates = candidates.slice(0, candidatePool);

  // Edge case: no matches
  if (pooledCandidates.length === 0) return [];

  // 2. Extract keywords from query
  const keywords = extractKeywords(query);

  // 3. Apply keyword boost
  const boostedCandidates = pooledCandidates.map(c => {
    const hasMatch = hasKeywordMatch(c.entity, keywords);
    return {
      entity: c.entity,
      score: hasMatch ? c.score + keywordBoost : c.score,
      keywordMatch: hasMatch,
    };
  });

  // Re-sort after boosting
  boostedCandidates.sort((a, b) => b.score - a.score);

  // 4. Get seed entities (top 3 after boosting)
  const seedIds = boostedCandidates.slice(0, 3).map(c => c.entity.id);

  // 5. Graph expansion
  const expanded = expandDependencies(graph, seedIds, graphDepth);
  const connectedIds = new Set<string>([
    ...expanded.primary.map(e => e.id),
    ...expanded.dependencies.map(e => e.id),
    ...expanded.dependents.map(e => e.id),
  ]);

  // 6. Final filtering and ranking
  const results: SearchResult[] = [];

  for (let i = 0; i < boostedCandidates.length; i++) {
    const { entity, score, keywordMatch } = boostedCandidates[i];

    // Exclusion: generic name with low score
    if (isGenericName(entity.name) && score < 0.7) continue;

    // Inclusion criteria
    const isTopFive = i < 5;
    const isConnected = connectedIds.has(entity.id);
    const isHighConfidence = score > 0.75;

    if (!isTopFive && !isConnected && !isHighConfidence) continue;

    // 7. Assign matchType
    let matchType: 'semantic' | 'keyword' | 'graph';
    if (keywordMatch) {
      matchType = 'keyword';
    } else if (isConnected && !isTopFive) {
      matchType = 'graph';
    } else {
      matchType = 'semantic';
    }

    results.push({ entity, score, matchType });
  }

  // 8. Sort and return top K
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}
