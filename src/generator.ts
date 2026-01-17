// ============================================================================
// FILE: src/generator.ts
// PURPOSE: Apply templates to entities, produce TrainingExamples
// ============================================================================

import { CodeEntity, TrainingExample, GeneratorConfig } from './types.js';
import { getTemplatesForEntity, QuestionTemplate } from './templates.js';

/**
 * generateExamplesForEntity - Generate training examples for a single entity
 * 
 * Applies applicable templates to the entity and creates TrainingExample
 * objects. Filters out low-quality responses (< 20 chars).
 * 
 * @param entity - The code entity to generate examples for
 * @param config - Generator configuration
 * @returns Array of TrainingExamples
 */
export function generateExamplesForEntity(
  entity: CodeEntity,
  config: GeneratorConfig
): TrainingExample[] {
  const templates = getTemplatesForEntity(entity).slice(0, config.questionsPerEntity);
  const examples: TrainingExample[] = [];
  
  for (const template of templates) {
    try {
      const instruction = template.instruction(entity);
      const response = template.generateResponse(entity);
      
      // Skip low-quality responses
      if (response.length < 20) continue;
      
      // Build context with file info and optional docstring
      const context = `// File: ${entity.file}\n${entity.docstring ? `/** ${entity.docstring} */\n` : ''}${entity.code}`;
      
      const example: TrainingExample = { instruction, context, response };
      
      // Add metadata if configured
      if (config.includeMetadata) {
        example.metadata = {
          source_file: entity.file,
          entity_name: entity.name,
          entity_type: entity.type,
          question_type: template.type,
          difficulty: template.difficulty
        };
      }
      
      examples.push(example);
    } catch (err) {
      console.error(`Error generating for ${entity.name}:`, err);
    }
  }
  
  return examples;
}

/**
 * generateAllExamples - Generate examples for all entities
 * 
 * Processes all entities, filtering by line count limits, and
 * generates training examples for each.
 * 
 * @param entities - Array of code entities to process
 * @param config - Generator configuration
 * @param onProgress - Optional callback for progress updates
 * @returns Array of all generated TrainingExamples
 */
export function generateAllExamples(
  entities: CodeEntity[],
  config: GeneratorConfig,
  onProgress?: (current: number, total: number) => void
): TrainingExample[] {
  const all: TrainingExample[] = [];
  
  // Filter entities by line count
  const valid = entities.filter(e => {
    const lines = e.endLine - e.startLine + 1;
    return lines >= config.minFunctionLines && lines <= config.maxFunctionLines;
  });
  
  // Generate examples for each valid entity
  for (let i = 0; i < valid.length; i++) {
    all.push(...generateExamplesForEntity(valid[i], config));
    onProgress?.(i + 1, valid.length);
  }
  
  return all;
}

/**
 * prepareDataset - Prepare dataset with optional train/val/test splits
 * 
 * Shuffles examples and optionally splits into train/val/test sets
 * based on the configured ratios.
 * 
 * @param examples - Array of training examples
 * @param config - Generator configuration with optional splitRatio
 * @returns Object with train (and optionally val, test) arrays
 */
export function prepareDataset(
  examples: TrainingExample[],
  config: GeneratorConfig
): { train: TrainingExample[]; val?: TrainingExample[]; test?: TrainingExample[] } {
  // Shuffle examples for randomization
  const shuffled = [...examples].sort(() => Math.random() - 0.5);
  
  // If no split ratio, return all as training
  if (!config.splitRatio) {
    return { train: shuffled };
  }
  
  // Calculate split indices
  const { train: tr, val: vl } = config.splitRatio;
  const trainEnd = Math.floor(shuffled.length * tr);
  const valEnd = trainEnd + Math.floor(shuffled.length * vl);
  
  return {
    train: shuffled.slice(0, trainEnd),
    val: shuffled.slice(trainEnd, valEnd),
    test: shuffled.slice(valEnd)
  };
}
