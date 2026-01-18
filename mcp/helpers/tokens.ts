// ============================================================================
// FILE: mcp/helpers/tokens.ts
// PURPOSE: Token estimation and budget enforcement
// ============================================================================

import { RankedEntity } from './ranking.js';

/**
 * estimateTokens - Estimate token count for text
 * 
 * Uses the standard approximation: 1 token ≈ 4 characters for code.
 * This matches most tokenizers (GPT, Claude) reasonably well.
 * 
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * BudgetResult - Result of applying token budget
 */
export interface BudgetResult {
  selected: RankedEntity[];
  totalTokens: number;
  dropped: number;
}

/**
 * enforceTokenBudget - Select entities within token budget
 * 
 * Iterates through ranked entities (highest score first) and includes
 * each one that fits within the remaining budget. Never truncates
 * code mid-snippet - either the full entity fits or it's dropped.
 * 
 * @param ranked - Entities sorted by relevance score (highest first)
 * @param maxTokens - Maximum token budget
 * @returns BudgetResult with selected entities
 */
export function enforceTokenBudget(
  ranked: RankedEntity[],
  maxTokens: number
): BudgetResult {
  const selected: RankedEntity[] = [];
  let totalTokens = 0;
  let dropped = 0;

  for (const item of ranked) {
    const entityTokens = item.entity.tokens;
    
    if (totalTokens + entityTokens <= maxTokens) {
      selected.push(item);
      totalTokens += entityTokens;
    } else {
      // Entity doesn't fit - skip it but continue trying smaller ones
      dropped++;
    }
  }

  return { selected, totalTokens, dropped };
}

/**
 * estimateTotalTokens - Calculate total tokens for all entities
 */
export function estimateTotalTokens(ranked: RankedEntity[]): number {
  return ranked.reduce((sum, r) => sum + r.entity.tokens, 0);
}

/**
 * TokenBudgetStats - Statistics about token budget usage
 */
export interface TokenBudgetStats {
  budget: number;
  used: number;
  available: number;
  utilization: number; // Percentage of budget used
}

/**
 * getBudgetStats - Get statistics about token budget usage
 */
export function getBudgetStats(
  budget: number,
  used: number
): TokenBudgetStats {
  return {
    budget,
    used,
    available: Math.max(0, budget - used),
    utilization: budget > 0 ? Math.round((used / budget) * 100) : 0,
  };
}
