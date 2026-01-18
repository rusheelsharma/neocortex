// ============================================================================
// FILE: src/retrieval/budget.ts
// PURPOSE: Select code entities within a token budget for LLM context
// ============================================================================

import { CodeEntity } from '../types.js';

/**
 * BudgetResult - Result of budget-constrained entity selection
 */
export interface BudgetResult {
  selected: CodeEntity[];
  totalTokens: number;
  context: string;
}

/**
 * selectWithinBudget - Greedy selection of entities within token budget
 * 
 * Iterates through ranked entities and adds each that fits.
 * Continues trying smaller entities even if one doesn't fit.
 * 
 * @param entities - Entities ranked by relevance (most relevant first)
 * @param maxTokens - Maximum token budget
 * @returns BudgetResult with selected entities and formatted context
 */
export function selectWithinBudget(
  entities: CodeEntity[],
  maxTokens: number
): BudgetResult {
  const selected: CodeEntity[] = [];
  let totalTokens = 0;

  for (const entity of entities) {
    if (totalTokens + entity.tokens <= maxTokens) {
      selected.push(entity);
      totalTokens += entity.tokens;
    }
  }

  const context = selected.map(formatEntity).join('\n\n');

  return { selected, totalTokens, context };
}

/**
 * formatEntity - Format a single entity for LLM context
 */
function formatEntity(entity: CodeEntity): string {
  const parts: string[] = [`// File: ${entity.file}`];
  
  if (entity.docstring) {
    parts.push(`/** ${entity.docstring} */`);
  }
  
  parts.push(entity.code);
  
  return parts.join('\n');
}
