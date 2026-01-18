// ============================================================================
// FILE: mcp/helpers/ranking.ts
// PURPOSE: Deterministic search ranking for code entities
// ============================================================================

import { CodeEntity } from '../../src/types.js';

/**
 * RankedEntity - An entity with its computed rank and reason for inclusion
 */
export interface RankedEntity {
  entity: CodeEntity;
  score: number;
  reason: string;
}

/**
 * MatchCategory - Types of matches in priority order
 */
export type MatchCategory = 
  | 'exact_name'        // Exact function/class name match
  | 'substring_name'    // Name contains query term
  | 'signature_match'   // Signature contains query
  | 'docstring_match'   // Docstring contains query
  | 'code_match'        // Code body contains query
  | 'dependency'        // Called by a primary match
  | 'dependent';        // Calls a primary match

/**
 * SCORE_WEIGHTS - Scoring weights for different match types
 * Higher = more relevant
 */
const SCORE_WEIGHTS: Record<MatchCategory, number> = {
  exact_name: 100,
  substring_name: 80,
  signature_match: 60,
  docstring_match: 50,
  code_match: 30,
  dependency: 25,
  dependent: 20,
};

/**
 * REASON_TEMPLATES - Human-readable reasons for inclusion
 */
const REASON_TEMPLATES: Record<MatchCategory, string> = {
  exact_name: 'Exact match on function name',
  substring_name: 'Function name contains query term',
  signature_match: 'Query matches function signature',
  docstring_match: 'Query found in documentation',
  code_match: 'Query found in code body',
  dependency: 'Called by {parent}',
  dependent: 'Calls {parent}',
};

/**
 * rankEntities - Rank entities by query relevance
 * 
 * Implements deterministic ranking:
 * 1. Exact name matches rank highest
 * 2. Then substring matches on name
 * 3. Then matches on signature/docstring
 * 4. Then matches on code content
 * 
 * @param query - Search query (natural language or symbol name)
 * @param entities - All entities to search
 * @param targets - Optional extracted target names from query classification
 * @returns Array of RankedEntity sorted by score descending
 */
export function rankEntities(
  query: string,
  entities: CodeEntity[],
  targets?: string[]
): RankedEntity[] {
  const results: RankedEntity[] = [];
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);
  
  // Add classifier targets to search terms for better matching
  const allSearchTerms = [...queryTerms];
  if (targets && targets.length > 0) {
    for (const target of targets) {
      const targetLower = target.toLowerCase();
      if (!allSearchTerms.includes(targetLower)) {
        allSearchTerms.push(targetLower);
      }
    }
  }

  for (const entity of entities) {
    const nameLower = entity.name.toLowerCase();
    const baseName = nameLower.split('.').pop() || nameLower;
    
    // Check each match type in priority order
    let matchCategory: MatchCategory | null = null;

    // 1. Exact name match (check against targets too)
    if (baseName === queryLower || nameLower === queryLower ||
        (targets && targets.some(t => baseName === t.toLowerCase() || nameLower === t.toLowerCase()))) {
      matchCategory = 'exact_name';
    }
    // 2. Substring match on name (using all search terms including targets)
    else if (
      nameLower.includes(queryLower) ||
      allSearchTerms.some(term => nameLower.includes(term))
    ) {
      matchCategory = 'substring_name';
    }
    // 3. Signature match
    else if (
      entity.signature.toLowerCase().includes(queryLower) ||
      allSearchTerms.some(term => entity.signature.toLowerCase().includes(term))
    ) {
      matchCategory = 'signature_match';
    }
    // 4. Docstring match
    else if (
      entity.docstring &&
      (entity.docstring.toLowerCase().includes(queryLower) ||
        allSearchTerms.some(term => entity.docstring!.toLowerCase().includes(term)))
    ) {
      matchCategory = 'docstring_match';
    }
    // 5. Code match
    else if (
      entity.code.toLowerCase().includes(queryLower) ||
      allSearchTerms.some(term => entity.code.toLowerCase().includes(term))
    ) {
      matchCategory = 'code_match';
    }

    if (matchCategory) {
      results.push({
        entity,
        score: SCORE_WEIGHTS[matchCategory],
        reason: REASON_TEMPLATES[matchCategory],
      });
    }
  }

  // Sort by score descending, then by name for stability
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entity.name.localeCompare(b.entity.name);
  });

  return results;
}

/**
 * addDependencyContext - Add dependencies and dependents to results
 * 
 * Expands the initial ranked results with related entities from the
 * dependency graph.
 * 
 * @param ranked - Initial ranked results
 * @param dependencies - Map of entity ID -> entities it calls
 * @param dependents - Map of entity ID -> entities that call it
 * @returns Expanded results with dependency context
 */
export function addDependencyContext(
  ranked: RankedEntity[],
  dependencies: Map<string, CodeEntity[]>,
  dependents: Map<string, CodeEntity[]>
): RankedEntity[] {
  const results = [...ranked];
  const includedIds = new Set(ranked.map(r => r.entity.id));

  // Process top results (limit to avoid explosion)
  const primaryMatches = ranked.slice(0, 5);

  for (const match of primaryMatches) {
    // Add dependencies (what this entity calls)
    const deps = dependencies.get(match.entity.id) || [];
    for (const dep of deps) {
      if (!includedIds.has(dep.id)) {
        results.push({
          entity: dep,
          score: SCORE_WEIGHTS.dependency,
          reason: REASON_TEMPLATES.dependency.replace('{parent}', match.entity.name),
        });
        includedIds.add(dep.id);
      }
    }

    // Add dependents (what calls this entity)
    const callers = dependents.get(match.entity.id) || [];
    for (const caller of callers) {
      if (!includedIds.has(caller.id)) {
        results.push({
          entity: caller,
          score: SCORE_WEIGHTS.dependent,
          reason: REASON_TEMPLATES.dependent.replace('{parent}', match.entity.name),
        });
        includedIds.add(caller.id);
      }
    }
  }

  // Re-sort after adding context
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entity.name.localeCompare(b.entity.name);
  });

  return results;
}

/**
 * deduplicateResults - Remove duplicate entities keeping highest score
 */
export function deduplicateResults(results: RankedEntity[]): RankedEntity[] {
  const seen = new Map<string, RankedEntity>();
  
  for (const result of results) {
    const existing = seen.get(result.entity.id);
    if (!existing || result.score > existing.score) {
      seen.set(result.entity.id, result);
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entity.name.localeCompare(b.entity.name);
  });
}
