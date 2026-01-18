// ============================================================================
// FILE: mcp/helpers/snippets.ts
// PURPOSE: Format code entities into snippets for LLM consumption
// ============================================================================

import { CodeEntity } from '../../src/types.js';
import { RankedEntity } from './ranking.js';

/**
 * CodeSnippet - A formatted code snippet ready for LLM context
 */
export interface CodeSnippet {
  path: string;
  startLine: number;
  endLine: number;
  code: string;
  reason: string;
}

/**
 * SearchStats - Statistics about the search operation
 */
export interface SearchStats {
  baseline_tokens: number;    // Tokens if entire codebase was included
  returned_tokens: number;    // Tokens actually returned
  reduction_percent: number;  // Percentage reduction achieved
  entities_searched: number;  // Total entities in the index
  entities_returned: number;  // Entities included in response
}

/**
 * formatSnippet - Convert a ranked entity to a code snippet
 */
export function formatSnippet(ranked: RankedEntity): CodeSnippet {
  return {
    path: ranked.entity.file,
    startLine: ranked.entity.startLine,
    endLine: ranked.entity.endLine,
    code: ranked.entity.code,
    reason: ranked.reason,
  };
}

/**
 * formatSnippets - Convert multiple ranked entities to snippets
 */
export function formatSnippets(ranked: RankedEntity[]): CodeSnippet[] {
  return ranked.map(formatSnippet);
}

/**
 * calculateStats - Calculate token statistics for the search
 * 
 * @param allEntities - All entities in the repository
 * @param selectedEntities - Entities selected for response
 * @returns SearchStats with token counts and reduction
 */
export function calculateStats(
  allEntities: CodeEntity[],
  selectedEntities: RankedEntity[]
): SearchStats {
  // Calculate baseline: tokens for entire codebase
  const baseline_tokens = allEntities.reduce((sum, e) => sum + e.tokens, 0);
  
  // Calculate returned: tokens for selected entities
  const returned_tokens = selectedEntities.reduce(
    (sum, r) => sum + r.entity.tokens,
    0
  );

  // Calculate reduction percentage
  const reduction_percent = baseline_tokens > 0
    ? Math.round((1 - returned_tokens / baseline_tokens) * 100)
    : 0;

  return {
    baseline_tokens,
    returned_tokens,
    reduction_percent,
    entities_searched: allEntities.length,
    entities_returned: selectedEntities.length,
  };
}

/**
 * formatContextBlock - Format snippets as a context block for LLMs
 * 
 * Creates a structured text block suitable for including in LLM prompts.
 */
export function formatContextBlock(snippets: CodeSnippet[]): string {
  const parts: string[] = [];

  for (const snippet of snippets) {
    parts.push(`// File: ${snippet.path} (lines ${snippet.startLine}-${snippet.endLine})`);
    parts.push(`// Reason: ${snippet.reason}`);
    parts.push(snippet.code);
    parts.push(''); // Empty line between snippets
  }

  return parts.join('\n');
}

/**
 * extractCodeLines - Extract specific lines from file content
 * 
 * @param content - Full file content
 * @param startLine - Starting line (1-indexed)
 * @param endLine - Ending line (1-indexed, inclusive)
 * @returns Code string for the specified range
 */
export function extractCodeLines(
  content: string,
  startLine: number,
  endLine: number
): string {
  const lines = content.split('\n');
  
  // Convert to 0-indexed
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);
  
  return lines.slice(start, end).join('\n');
}
