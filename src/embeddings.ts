// ============================================================================
// FILE: src/embeddings.ts
// PURPOSE: Vector embeddings and semantic search with dependency graph integration
// ============================================================================

import * as fs from 'fs/promises';
import { CodeEntity, EntityType } from './types.js';
import {
  DependencyGraph,
  ExpandedContext,
  buildDependencyGraph,
  expandDependencies,
  findEntitiesByName,
  getDirectDependencies,
  getDirectDependents,
} from './graph.js';

// ----------------------------------------------------------------------------
// SECTION 1: TYPE DEFINITIONS
// ----------------------------------------------------------------------------

/**
 * EmbeddingVector - A single entity's embedding representation
 * 
 * @property entityId - Unique identifier from CodeEntity
 * @property entityName - Name of the function/class/etc
 * @property entityType - Type of code entity
 * @property filePath - Source file path
 * @property vector - The embedding vector (array of floats)
 * @property textUsed - The text that was embedded (for debugging)
 */
export interface EmbeddingVector {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  filePath: string;
  vector: number[];
  textUsed: string;
}

/**
 * SimilarityResult - A single search result with similarity score
 * 
 * @property entity - The matched embedding vector
 * @property score - Cosine similarity score (0-1, higher is more similar)
 */
export interface SimilarityResult {
  entity: EmbeddingVector;
  score: number;
}

/**
 * SemanticSearchResult - Complete search result with graph expansion
 * 
 * @property query - The original search query
 * @property matches - Direct semantic matches
 * @property expanded - Expanded context from dependency graph
 * @property totalContextEntities - Total entities in expanded context
 */
export interface SemanticSearchResult {
  query: string;
  matches: SimilarityResult[];
  expanded: ExpandedContext | null;
  totalContextEntities: number;
}

/**
 * EmbeddingConfig - Configuration for embedding generation
 * 
 * @property model - Which embedding model to use
 * @property batchSize - Number of texts per API call
 * @property includeCode - Whether to include full code in embedding text
 * @property includeDependencyContext - Whether to add dependency info to text
 * @property maxTokens - Maximum tokens for embedding text
 */
export interface EmbeddingConfig {
  model: 'voyage-code-2' | 'openai';
  batchSize: number;
  includeCode: boolean;
  includeDependencyContext: boolean;
  maxTokens: number;
}

/**
 * DEFAULT_EMBEDDING_CONFIG - Sensible defaults for embedding generation
 */
export const DEFAULT_EMBEDDING_CONFIG: EmbeddingConfig = {
  model: 'openai',
  batchSize: 32,
  includeCode: false,
  includeDependencyContext: true,
  maxTokens: 512,
};

/**
 * SemanticIndex - Complete semantic index for a repository
 * 
 * @property store - Vector store with all embeddings
 * @property graph - Dependency graph for context expansion
 * @property entities - Original code entities
 */
export interface SemanticIndex {
  store: VectorStore;
  graph: DependencyGraph;
  entities: CodeEntity[];
}

// ----------------------------------------------------------------------------
// SECTION 2: TEXT PREPARATION
// ----------------------------------------------------------------------------

/**
 * prepareTextForEmbedding - Convert a CodeEntity to embeddable text
 * 
 * Creates a rich text representation of the entity that captures:
 * - Entity type and name
 * - Function signature
 * - Documentation
 * - Parameters and return type
 * - Dependency context (if enabled and graph provided)
 * 
 * @param entity - The code entity to prepare
 * @param config - Embedding configuration
 * @param graph - Optional dependency graph for context
 * @returns Prepared text string for embedding
 * 
 * EXAMPLE OUTPUT:
 * "[function] parseFile
 * Signature: parseFile(filePath: string): Promise<CodeEntity[]>
 * Description: Parse a single source file and extract all code entities
 * Parameters: filePath (string)
 * Returns: Promise<CodeEntity[]>
 * Calls: readFile, walkNode, extractEntity
 * Called by: generate, preview"
 */
export function prepareTextForEmbedding(
  entity: CodeEntity,
  config: EmbeddingConfig,
  graph?: DependencyGraph
): string {
  const parts: string[] = [];

  // Entity type and name
  parts.push(`[${entity.type}] ${entity.name}`);

  // Signature
  if (entity.signature) {
    parts.push(`Signature: ${entity.signature}`);
  }

  // Docstring/description
  if (entity.docstring) {
    parts.push(`Description: ${entity.docstring}`);
  }

  // Parameters
  if (entity.parameters.length > 0) {
    const paramStrs = entity.parameters.map(p => {
      let s = p.name;
      if (p.type) s += ` (${p.type})`;
      if (p.optional) s += ' [optional]';
      return s;
    });
    parts.push(`Parameters: ${paramStrs.join(', ')}`);
  }

  // Return type
  if (entity.returnType) {
    parts.push(`Returns: ${entity.returnType}`);
  }

  // Class-specific: methods and properties
  if (entity.methods && entity.methods.length > 0) {
    parts.push(`Methods: ${entity.methods.join(', ')}`);
  }
  if (entity.properties && entity.properties.length > 0) {
    parts.push(`Properties: ${entity.properties.join(', ')}`);
  }

  // Dependency context (if enabled and graph provided)
  if (config.includeDependencyContext && graph) {
    const deps = getDirectDependencies(graph, entity.id);
    if (deps.length > 0) {
      parts.push(`Calls: ${deps.map(d => d.name).join(', ')}`);
    }

    const dependents = getDirectDependents(graph, entity.id);
    if (dependents.length > 0) {
      parts.push(`Called by: ${dependents.map(d => d.name).join(', ')}`);
    }
  }

  // Include code if configured
  if (config.includeCode && entity.code) {
    parts.push(`Code:\n${entity.code}`);
  }

  // File path for context
  parts.push(`File: ${entity.file}`);

  // Join and truncate
  const text = parts.join('\n');
  const maxChars = config.maxTokens * 4; // Rough approximation: 1 token ≈ 4 chars
  
  if (text.length > maxChars) {
    return text.substring(0, maxChars - 3) + '...';
  }
  
  return text;
}

// ----------------------------------------------------------------------------
// SECTION 3: EMBEDDING GENERATION
// ----------------------------------------------------------------------------

/**
 * generateEmbeddingsOpenAI - Generate embeddings using OpenAI API
 * 
 * Uses text-embedding-3-small model which provides good quality
 * at lower cost. Returns 1536-dimensional vectors.
 * 
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors
 */
async function generateEmbeddingsOpenAI(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${error}`);
  }

  const data = await response.json();
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding);
}

/**
 * generateEmbeddingsVoyage - Generate embeddings using Voyage AI API
 * 
 * Uses voyage-code-2 model which is specifically trained for code.
 * Better for code search but requires separate API key.
 * 
 * @param texts - Array of text strings to embed
 * @returns Array of embedding vectors
 */
async function generateEmbeddingsVoyage(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error('VOYAGE_API_KEY environment variable is not set');
  }

  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'voyage-code-2',
      input: texts,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI API error: ${response.status} ${response.statusText} - ${error}`);
  }

  const data = await response.json();
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding);
}

/**
 * generateEmbeddings - Generate embeddings using configured model
 * 
 * @param texts - Array of text strings to embed
 * @param model - Which model to use
 * @returns Array of embedding vectors
 */
async function generateEmbeddings(
  texts: string[],
  model: 'openai' | 'voyage-code-2'
): Promise<number[][]> {
  if (model === 'voyage-code-2') {
    return generateEmbeddingsVoyage(texts);
  }
  return generateEmbeddingsOpenAI(texts);
}

/**
 * embedEntities - Generate embeddings for all entities
 * 
 * Processes entities in batches to respect API rate limits.
 * Includes progress callback for UI feedback.
 * 
 * @param entities - Array of code entities to embed
 * @param graph - Dependency graph for context
 * @param config - Embedding configuration
 * @param onProgress - Optional progress callback
 * @returns Array of EmbeddingVector objects
 */
export async function embedEntities(
  entities: CodeEntity[],
  graph: DependencyGraph,
  config: EmbeddingConfig,
  onProgress?: (current: number, total: number) => void
): Promise<EmbeddingVector[]> {
  const results: EmbeddingVector[] = [];
  const totalBatches = Math.ceil(entities.length / config.batchSize);

  for (let i = 0; i < entities.length; i += config.batchSize) {
    const batch = entities.slice(i, i + config.batchSize);
    const batchNum = Math.floor(i / config.batchSize) + 1;

    // Prepare texts for this batch
    const texts = batch.map(entity => prepareTextForEmbedding(entity, config, graph));

    // Generate embeddings
    const vectors = await generateEmbeddings(texts, config.model);

    // Map back to entities
    for (let j = 0; j < batch.length; j++) {
      results.push({
        entityId: batch[j].id,
        entityName: batch[j].name,
        entityType: batch[j].type,
        filePath: batch[j].file,
        vector: vectors[j],
        textUsed: texts[j],
      });
    }

    // Progress callback
    onProgress?.(Math.min(i + config.batchSize, entities.length), entities.length);

    // Rate limiting delay between batches (skip on last batch)
    if (batchNum < totalBatches) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

// ----------------------------------------------------------------------------
// SECTION 4: VECTOR SIMILARITY
// ----------------------------------------------------------------------------

/**
 * cosineSimilarity - Calculate cosine similarity between two vectors
 * 
 * Cosine similarity measures the angle between vectors:
 * - 1.0 = identical direction (most similar)
 * - 0.0 = perpendicular (unrelated)
 * - -1.0 = opposite direction (most dissimilar)
 * 
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

// ----------------------------------------------------------------------------
// SECTION 5: VECTOR STORE CLASS
// ----------------------------------------------------------------------------

/**
 * VectorStore - In-memory vector storage with similarity search
 * 
 * Provides:
 * - Fast lookup by entity ID
 * - Brute-force similarity search (sufficient for <100K vectors)
 * - Serialization for persistence
 */
export class VectorStore {
  private vectors: EmbeddingVector[] = [];
  private idIndex: Map<string, number> = new Map();

  /**
   * add - Add a single embedding to the store
   */
  add(embedding: EmbeddingVector): void {
    const index = this.vectors.length;
    this.vectors.push(embedding);
    this.idIndex.set(embedding.entityId, index);
  }

  /**
   * addBatch - Add multiple embeddings to the store
   */
  addBatch(embeddings: EmbeddingVector[]): void {
    for (const embedding of embeddings) {
      this.add(embedding);
    }
  }

  /**
   * get - Retrieve an embedding by entity ID
   */
  get(entityId: string): EmbeddingVector | undefined {
    const index = this.idIndex.get(entityId);
    if (index === undefined) return undefined;
    return this.vectors[index];
  }

  /**
   * findSimilar - Find most similar vectors to a query vector
   * 
   * Uses brute-force search which is O(n) but fast enough for
   * repositories with up to ~100K entities.
   * 
   * @param queryVector - The query embedding vector
   * @param topK - Number of results to return
   * @param filter - Optional filter function
   * @returns Array of SimilarityResult sorted by score descending
   */
  findSimilar(
    queryVector: number[],
    topK: number,
    filter?: (e: EmbeddingVector) => boolean
  ): SimilarityResult[] {
    const results: SimilarityResult[] = [];

    for (const entity of this.vectors) {
      // Apply filter if provided
      if (filter && !filter(entity)) continue;

      const score = cosineSimilarity(queryVector, entity.vector);
      results.push({ entity, score });
    }

    // Sort by score descending and take top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * findSimilarTo - Find entities similar to another entity
   * 
   * @param entityId - ID of the reference entity
   * @param topK - Number of results to return
   * @returns Array of SimilarityResult (excludes the reference entity)
   */
  findSimilarTo(entityId: string, topK: number): SimilarityResult[] {
    const entity = this.get(entityId);
    if (!entity) return [];

    return this.findSimilar(
      entity.vector,
      topK + 1, // Get one extra since we'll filter out self
      e => e.entityId !== entityId
    ).slice(0, topK);
  }

  /**
   * getAllEntityIds - Get all entity IDs in the store
   */
  getAllEntityIds(): string[] {
    return this.vectors.map(v => v.entityId);
  }

  /**
   * size - Get the number of vectors in the store
   */
  get size(): number {
    return this.vectors.length;
  }

  /**
   * toJSON - Serialize the store to JSON string
   * 
   * Used for persistence. The vectors array is serialized directly.
   */
  toJSON(): string {
    return JSON.stringify({
      vectors: this.vectors,
      version: 1,
    });
  }

  /**
   * fromJSON - Deserialize a store from JSON string
   */
  static fromJSON(json: string): VectorStore {
    const data = JSON.parse(json);
    const store = new VectorStore();
    
    if (data.vectors) {
      store.addBatch(data.vectors);
    }
    
    return store;
  }
}

// ----------------------------------------------------------------------------
// SECTION 6: SEMANTIC SEARCH FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * embedQuery - Generate embedding for a search query
 * 
 * @param query - Search query string
 * @param model - Embedding model to use
 * @returns Query embedding vector
 */
async function embedQuery(
  query: string,
  model: 'openai' | 'voyage-code-2'
): Promise<number[]> {
  const vectors = await generateEmbeddings([query], model);
  return vectors[0];
}

/**
 * semanticSearch - Main semantic search function
 * 
 * Combines vector similarity search with dependency graph expansion
 * to find relevant code and its context.
 * 
 * Algorithm:
 * 1. Embed the query string
 * 2. Find similar entities in vector store
 * 3. Extract entity IDs from matches
 * 4. Expand dependencies using graph
 * 5. Return combined results
 * 
 * @param query - Natural language search query
 * @param store - Vector store with embeddings
 * @param graph - Dependency graph for expansion
 * @param options - Search options
 * @returns SemanticSearchResult with matches and expanded context
 */
export async function semanticSearch(
  query: string,
  store: VectorStore,
  graph: DependencyGraph,
  options?: {
    topK?: number;
    expandDepth?: number;
    model?: 'openai' | 'voyage-code-2';
  }
): Promise<SemanticSearchResult> {
  const topK = options?.topK ?? 5;
  const expandDepth = options?.expandDepth ?? 2;
  const model = options?.model ?? 'openai';

  // Step 1: Embed the query
  const queryVector = await embedQuery(query, model);

  // Step 2: Find similar entities
  const matches = store.findSimilar(queryVector, topK);

  // Step 3: Extract entity IDs for expansion
  const seedIds = matches.map(m => m.entity.entityId);

  // Step 4: Expand dependencies
  let expanded: ExpandedContext | null = null;
  let totalContextEntities = matches.length;

  if (seedIds.length > 0 && expandDepth > 0) {
    expanded = expandDependencies(graph, seedIds, expandDepth);
    totalContextEntities =
      expanded.primary.length +
      expanded.dependencies.length +
      expanded.dependents.length +
      expanded.types.length;
  }

  // Step 5: Return results
  return {
    query,
    matches,
    expanded,
    totalContextEntities,
  };
}

/**
 * searchByName - Search for entities by exact name
 * 
 * Uses the dependency graph's name index for exact matching,
 * then expands dependencies for context.
 * 
 * @param name - Exact function/class name to search
 * @param store - Vector store (used to get EmbeddingVector for results)
 * @param graph - Dependency graph
 * @param expandDepth - How deep to expand dependencies
 * @returns SemanticSearchResult with matches and context
 */
export function searchByName(
  name: string,
  store: VectorStore,
  graph: DependencyGraph,
  expandDepth: number
): SemanticSearchResult {
  // Step 1: Find entities by name using graph
  const entities = findEntitiesByName(graph, name);

  // Step 2: Map to SimilarityResult with score 1.0 (exact match)
  const matches: SimilarityResult[] = entities
    .map(entity => {
      const embedding = store.get(entity.id);
      if (!embedding) return null;
      return { entity: embedding, score: 1.0 };
    })
    .filter((m): m is SimilarityResult => m !== null);

  // Step 3: Expand dependencies
  const seedIds = entities.map(e => e.id);
  let expanded: ExpandedContext | null = null;
  let totalContextEntities = matches.length;

  if (seedIds.length > 0 && expandDepth > 0) {
    expanded = expandDependencies(graph, seedIds, expandDepth);
    totalContextEntities =
      expanded.primary.length +
      expanded.dependencies.length +
      expanded.dependents.length +
      expanded.types.length;
  }

  return {
    query: name,
    matches,
    expanded,
    totalContextEntities,
  };
}

// ----------------------------------------------------------------------------
// SECTION 7: RESULT FORMATTING
// ----------------------------------------------------------------------------

/**
 * formatSearchResults - Format search results for display
 * 
 * Creates a readable output showing:
 * - Primary matches with scores
 * - Dependencies (functions called by matches)
 * - Dependents (functions that call matches)
 * - Related types
 * - Optionally, code snippets
 * 
 * @param result - Search result to format
 * @param graph - Dependency graph for entity lookup
 * @param options - Formatting options
 * @returns Formatted string for console output
 */
export function formatSearchResults(
  result: SemanticSearchResult,
  graph: DependencyGraph,
  options?: { includeCode?: boolean; maxEntities?: number }
): string {
  const includeCode = options?.includeCode ?? false;
  const maxEntities = options?.maxEntities ?? 10;

  const lines: string[] = [];

  // Header
  lines.push(`# Search: "${result.query}"`);
  lines.push(`Found ${result.matches.length} direct matches, ${result.totalContextEntities} total with context`);
  lines.push('');

  // Primary matches
  if (result.matches.length > 0) {
    lines.push('## Primary Matches');
    for (const match of result.matches.slice(0, maxEntities)) {
      lines.push(`- **${match.entity.entityName}** (${match.entity.entityType}) - score: ${match.score.toFixed(3)}`);
      lines.push(`  File: ${match.entity.filePath}`);
    }
    lines.push('');
  }

  // Expanded context
  if (result.expanded) {
    // Dependencies
    if (result.expanded.dependencies.length > 0) {
      lines.push('## Dependencies (called by matches)');
      for (const dep of result.expanded.dependencies.slice(0, maxEntities)) {
        lines.push(`- ${dep.name} (${dep.type}) - ${dep.file}`);
      }
      if (result.expanded.dependencies.length > maxEntities) {
        lines.push(`  ... and ${result.expanded.dependencies.length - maxEntities} more`);
      }
      lines.push('');
    }

    // Dependents
    if (result.expanded.dependents.length > 0) {
      lines.push('## Dependents (call the matches)');
      for (const dep of result.expanded.dependents.slice(0, maxEntities)) {
        lines.push(`- ${dep.name} (${dep.type}) - ${dep.file}`);
      }
      if (result.expanded.dependents.length > maxEntities) {
        lines.push(`  ... and ${result.expanded.dependents.length - maxEntities} more`);
      }
      lines.push('');
    }

    // Related types
    if (result.expanded.types.length > 0) {
      lines.push('## Related Types');
      for (const type of result.expanded.types.slice(0, maxEntities)) {
        lines.push(`- ${type.name} (${type.type})`);
      }
      if (result.expanded.types.length > maxEntities) {
        lines.push(`  ... and ${result.expanded.types.length - maxEntities} more`);
      }
      lines.push('');
    }
  }

  // Code context (if requested)
  if (includeCode && result.matches.length > 0) {
    lines.push('## Code Context');
    for (const match of result.matches.slice(0, 3)) {
      // Look up the full entity from the graph to get code
      const entity = graph.entities.get(match.entity.entityId);
      if (entity && entity.code) {
        lines.push(`### ${match.entity.entityName}`);
        lines.push('```typescript');
        // Truncate long code
        const code = entity.code.length > 1000
          ? entity.code.substring(0, 1000) + '\n// ... truncated ...'
          : entity.code;
        lines.push(code);
        lines.push('```');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ----------------------------------------------------------------------------
// SECTION 8: MAIN PIPELINE FUNCTION
// ----------------------------------------------------------------------------

/**
 * buildSemanticIndex - Build complete semantic index for a repository
 * 
 * This is the main entry point for creating a searchable index:
 * 1. Build dependency graph from entities
 * 2. Generate embeddings for all entities
 * 3. Create vector store
 * 4. Return complete index
 * 
 * @param entities - Array of code entities from parsing
 * @param config - Embedding configuration
 * @param onProgress - Optional progress callback for UI
 * @returns Complete SemanticIndex
 */
export async function buildSemanticIndex(
  entities: CodeEntity[],
  config: EmbeddingConfig,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<SemanticIndex> {
  // Step 1: Build dependency graph
  onProgress?.('Building dependency graph', 0, 1);
  const graph = buildDependencyGraph(entities);
  onProgress?.('Building dependency graph', 1, 1);

  // Step 2: Generate embeddings
  const embeddings = await embedEntities(
    entities,
    graph,
    config,
    (current, total) => onProgress?.('Generating embeddings', current, total)
  );

  // Step 3: Create vector store
  onProgress?.('Creating vector store', 0, 1);
  const store = new VectorStore();
  store.addBatch(embeddings);
  onProgress?.('Creating vector store', 1, 1);

  return { store, graph, entities };
}

// ----------------------------------------------------------------------------
// SECTION 9: PERSISTENCE FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * saveSemanticIndex - Save a semantic index to disk
 * 
 * Saves:
 * - Vector store to ${basePath}.vectors.json
 * - Entity IDs to ${basePath}.entities.json (for rebuilding graph)
 * 
 * @param index - Semantic index to save
 * @param basePath - Base path for output files (without extension)
 */
export async function saveSemanticIndex(
  index: SemanticIndex,
  basePath: string
): Promise<void> {
  // Ensure directory exists
  const dir = basePath.substring(0, basePath.lastIndexOf('/'));
  if (dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Save vector store
  const vectorsPath = `${basePath}.vectors.json`;
  await fs.writeFile(vectorsPath, index.store.toJSON(), 'utf-8');

  // Save entity IDs for reference
  const entitiesPath = `${basePath}.entities.json`;
  const entityIds = index.entities.map(e => e.id);
  await fs.writeFile(entitiesPath, JSON.stringify({ entityIds, count: entityIds.length }), 'utf-8');
}

/**
 * loadSemanticIndex - Load a semantic index from disk
 * 
 * Loads vector store from disk and rebuilds graph from entities.
 * Requires the same entities that were used to build the index.
 * 
 * @param basePath - Base path for input files
 * @param entities - Code entities (must match original)
 * @returns Reconstructed SemanticIndex
 */
export async function loadSemanticIndex(
  basePath: string,
  entities: CodeEntity[]
): Promise<SemanticIndex> {
  // Load vector store
  const vectorsPath = `${basePath}.vectors.json`;
  const vectorsJson = await fs.readFile(vectorsPath, 'utf-8');
  const store = VectorStore.fromJSON(vectorsJson);

  // Rebuild graph from entities
  const graph = buildDependencyGraph(entities);

  return { store, graph, entities };
}

// ----------------------------------------------------------------------------
// SECTION 10: UTILITY FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * getEmbeddingStats - Get statistics about embeddings
 * 
 * @param store - Vector store to analyze
 * @returns Statistics object
 */
export function getEmbeddingStats(store: VectorStore): {
  totalVectors: number;
  byType: Record<string, number>;
  avgVectorDimension: number;
} {
  const byType: Record<string, number> = {};
  let totalDimension = 0;
  let count = 0;

  for (const id of store.getAllEntityIds()) {
    const vector = store.get(id);
    if (vector) {
      byType[vector.entityType] = (byType[vector.entityType] || 0) + 1;
      totalDimension += vector.vector.length;
      count++;
    }
  }

  return {
    totalVectors: store.size,
    byType,
    avgVectorDimension: count > 0 ? totalDimension / count : 0,
  };
}

