// ============================================================================
// FILE: src/output.ts
// PURPOSE: Write JSONL files and format statistics
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';
import { TrainingExample, GenerationStats, CodeEntity } from './types.js';

/**
 * writeJSONL - Write training examples to a JSONL file
 * 
 * Each example is written as a single JSON line.
 * 
 * @param examples - Array of training examples
 * @param outputPath - Path to output file
 */
export async function writeJSONL(
  examples: TrainingExample[],
  outputPath: string
): Promise<void> {
  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  
  // Convert to JSONL format (one JSON object per line)
  const content = examples.map(e => JSON.stringify(e)).join('\n') + '\n';
  
  await fs.writeFile(outputPath, content, 'utf-8');
}

/**
 * writeDatasetSplits - Write train/val/test splits to separate files
 * 
 * @param dataset - Object containing train, val, test arrays
 * @param basePath - Base path for output files
 * @returns Array of written file paths
 */
export async function writeDatasetSplits(
  dataset: { train: TrainingExample[]; val?: TrainingExample[]; test?: TrainingExample[] },
  basePath: string
): Promise<string[]> {
  const written: string[] = [];
  const base = basePath.replace('.jsonl', '');
  
  // Always write training set
  await writeJSONL(dataset.train, `${base}-train.jsonl`);
  written.push(`${base}-train.jsonl`);
  
  // Write validation set if present
  if (dataset.val?.length) {
    await writeJSONL(dataset.val, `${base}-val.jsonl`);
    written.push(`${base}-val.jsonl`);
  }
  
  // Write test set if present
  if (dataset.test?.length) {
    await writeJSONL(dataset.test, `${base}-test.jsonl`);
    written.push(`${base}-test.jsonl`);
  }
  
  return written;
}

/**
 * writeStats - Write generation statistics to a JSON file
 * 
 * @param stats - Generation statistics
 * @param outputPath - Base output path (will have -stats.json appended)
 */
export async function writeStats(
  stats: GenerationStats,
  outputPath: string
): Promise<void> {
  const statsPath = outputPath.replace('.jsonl', '-stats.json');
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), 'utf-8');
}

/**
 * calculateStats - Calculate statistics for a generation run
 * 
 * @param repoName - Name of the processed repository
 * @param filesProcessed - Number of files parsed
 * @param entities - Array of extracted entities
 * @param examples - Array of generated examples
 * @param startTime - Start timestamp (Date.now())
 * @returns GenerationStats object
 */
export function calculateStats(
  repoName: string,
  filesProcessed: number,
  entities: CodeEntity[],
  examples: TrainingExample[],
  startTime: number
): GenerationStats {
  // Estimate total tokens (chars / 4 is a rough approximation)
  const totalTokens = examples.reduce((sum, ex) => {
    return sum + Math.ceil((ex.instruction + ex.context + ex.response).length / 4);
  }, 0);
  
  return {
    repoName,
    filesProcessed,
    entitiesFound: {
      functions: entities.filter(e => e.type === 'function').length,
      classes: entities.filter(e => e.type === 'class').length,
      methods: entities.filter(e => e.type === 'method').length,
      interfaces: entities.filter(e => e.type === 'interface').length,
      types: entities.filter(e => e.type === 'type').length,
      total: entities.length
    },
    examplesGenerated: examples.length,
    totalTokens,
    estimatedCost: (totalTokens / 1000) * 0.008, // Rough estimate
    processingTimeMs: Date.now() - startTime
  };
}

/**
 * formatStats - Format statistics for console output
 * 
 * @param stats - Generation statistics
 * @returns Formatted string for display
 */
export function formatStats(stats: GenerationStats): string {
  return `
📊 Statistics
═══════════════════════════════
Repository:      ${stats.repoName}
Files:           ${stats.filesProcessed}
Entities:        ${stats.entitiesFound.total} (${stats.entitiesFound.functions} functions, ${stats.entitiesFound.methods} methods, ${stats.entitiesFound.classes} classes)
Examples:        ${stats.examplesGenerated}
Tokens:          ${stats.totalTokens.toLocaleString()}
Est. cost:       $${stats.estimatedCost.toFixed(2)}
Time:            ${(stats.processingTimeMs / 1000).toFixed(2)}s
`;
}
