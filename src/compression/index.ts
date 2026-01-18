// src/compression/index.ts

import { extractQueryTerms, sliceCodeWithStats, estimateTokens } from './slicer.js';

export interface CompressedEntity {
  id: string;
  name: string;
  file: string;
  originalCode: string;
  slicedCode: string;
  originalTokens: number;
  slicedTokens: number;
  relevanceScore: number;
}

export interface CompressionPipelineResult {
  entities: CompressedEntity[];
  context: string;
  stats: {
    totalOriginalTokens: number;
    afterSlicing: number;
    entitiesIncluded: number;
    slicingReduction: string;
  };
}

export async function compressionPipeline(
  entities: Array<{
    id: string;
    name: string;
    file: string;
    code: string;
    tokens: number;
    score: number;
  }>,
  query: string,
  maxTokens: number
): Promise<CompressionPipelineResult> {

  // Step 1: Extract query terms
  const queryTerms = extractQueryTerms(query);
  console.log(`   Query terms: ${queryTerms.join(', ')}`);

  // Step 2: Slice each entity
  const sliced: CompressedEntity[] = entities.map(entity => {
    const result = sliceCodeWithStats(entity.code, queryTerms);

    return {
      id: entity.id,
      name: entity.name,
      file: entity.file,
      originalCode: entity.code,
      slicedCode: result.slicedCode,
      originalTokens: result.originalTokens,
      slicedTokens: result.slicedTokens,
      relevanceScore: entity.score
    };
  });

  // Step 3: Budget selection on SLICED tokens
  const selected: CompressedEntity[] = [];
  let totalSlicedTokens = 0;

  const sorted = [...sliced].sort((a, b) => b.relevanceScore - a.relevanceScore);

  for (const entity of sorted) {
    if (totalSlicedTokens + entity.slicedTokens <= maxTokens) {
      selected.push(entity);
      totalSlicedTokens += entity.slicedTokens;
    }
  }

  // Step 4: Format context
  const context = selected
    .map(e => `// File: ${e.file}\n// Function: ${e.name}\n${e.slicedCode}`)
    .join('\n\n');

  // Step 5: Calculate stats
  const totalOriginalTokens = selected.reduce((sum, e) => sum + e.originalTokens, 0);
  const slicingReduction = totalOriginalTokens > 0 
    ? Math.round((1 - totalSlicedTokens / totalOriginalTokens) * 100)
    : 0;

  return {
    entities: selected,
    context,
    stats: {
      totalOriginalTokens,
      afterSlicing: totalSlicedTokens,
      entitiesIncluded: selected.length,
      slicingReduction: `${slicingReduction}%`
    }
  };
}

export { extractQueryTerms, sliceCode, sliceCodeWithStats, estimateTokens } from './slicer.js';
