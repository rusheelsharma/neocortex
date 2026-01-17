// ============================================================================
// FILE: src/graph.ts
// PURPOSE: Build and query dependency graph from code entities
// ============================================================================

import { CodeEntity } from './types.js';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

/**
 * DependencyGraph - Tracks relationships between code entities
 * 
 * @property entities - Map of entity ID to entity object
 * @property nameToIds - Map of entity name to IDs (handles duplicates)
 * @property calls - Forward edges: entity ID -> IDs of entities it calls
 * @property calledBy - Backward edges: entity ID -> IDs of entities that call it
 */
export interface DependencyGraph {
  entities: Map<string, CodeEntity>;
  nameToIds: Map<string, string[]>;
  calls: Map<string, Set<string>>;
  calledBy: Map<string, Set<string>>;
}

/**
 * ExpandedContext - Result of dependency expansion
 */
export interface ExpandedContext {
  primary: CodeEntity[];      // Direct matches
  dependencies: CodeEntity[]; // Functions called by primary
  dependents: CodeEntity[];   // Functions that call primary
  types: CodeEntity[];        // Related interfaces/types
}

// ----------------------------------------------------------------------------
// GRAPH BUILDING
// ----------------------------------------------------------------------------

/**
 * buildDependencyGraph - Create a dependency graph from entities
 * 
 * Process:
 * 1. Index all entities by ID and name
 * 2. For each entity, look at its `calls` array
 * 3. Resolve call names to entity IDs
 * 4. Create forward edges (calls) and backward edges (calledBy)
 * 
 * @param entities - Array of all CodeEntity objects from parsing
 * @returns Complete DependencyGraph
 */
export function buildDependencyGraph(entities: CodeEntity[]): DependencyGraph {
  const graph: DependencyGraph = {
    entities: new Map(),
    nameToIds: new Map(),
    calls: new Map(),
    calledBy: new Map(),
  };

  // Step 1: Index all entities
  for (const entity of entities) {
    // Store entity by ID
    graph.entities.set(entity.id, entity);

    // Index by name (multiple entities can have same name)
    const name = extractBaseName(entity.name);
    if (!graph.nameToIds.has(name)) {
      graph.nameToIds.set(name, []);
    }
    graph.nameToIds.get(name)!.push(entity.id);

    // Initialize edge sets
    graph.calls.set(entity.id, new Set());
    graph.calledBy.set(entity.id, new Set());
  }

  // Step 2: Build edges from calls
  for (const entity of entities) {
    for (const callName of entity.calls) {
      // Find entities that match this call name
      const calledIds = graph.nameToIds.get(callName) || [];
      
      for (const calledId of calledIds) {
        // Skip self-references
        if (calledId === entity.id) continue;

        // Add forward edge: this entity calls calledId
        graph.calls.get(entity.id)!.add(calledId);

        // Add backward edge: calledId is called by this entity
        graph.calledBy.get(calledId)!.add(entity.id);
      }
    }
  }

  return graph;
}

/**
 * extractBaseName - Get the base function name without class prefix
 * 
 * "Calculator.add" -> "add"
 * "processOrder" -> "processOrder"
 */
function extractBaseName(name: string): string {
  if (name.includes('.')) {
    return name.split('.').pop() || name;
  }
  return name;
}

// ----------------------------------------------------------------------------
// GRAPH QUERYING
// ----------------------------------------------------------------------------

/**
 * getDirectDependencies - Get entities that this entity calls
 * 
 * @param graph - The dependency graph
 * @param entityId - ID of the entity to query
 * @returns Array of CodeEntity objects that are called
 */
export function getDirectDependencies(
  graph: DependencyGraph,
  entityId: string
): CodeEntity[] {
  const callIds = graph.calls.get(entityId);
  if (!callIds) return [];

  const deps: CodeEntity[] = [];
  for (const id of callIds) {
    const entity = graph.entities.get(id);
    if (entity) deps.push(entity);
  }
  return deps;
}

/**
 * getDirectDependents - Get entities that call this entity
 * 
 * @param graph - The dependency graph
 * @param entityId - ID of the entity to query
 * @returns Array of CodeEntity objects that call this one
 */
export function getDirectDependents(
  graph: DependencyGraph,
  entityId: string
): CodeEntity[] {
  const callerIds = graph.calledBy.get(entityId);
  if (!callerIds) return [];

  const dependents: CodeEntity[] = [];
  for (const id of callerIds) {
    const entity = graph.entities.get(id);
    if (entity) dependents.push(entity);
  }
  return dependents;
}

/**
 * expandDependencies - BFS expansion from seed entities
 * 
 * This is the core "Dependency Expansion" algorithm:
 * 1. Start with seed entities (primary matches)
 * 2. BFS traverse to find dependencies and dependents
 * 3. Limit by depth to avoid explosion
 * 4. Categorize results
 * 
 * @param graph - The dependency graph
 * @param seedIds - IDs of primary match entities
 * @param maxDepth - Maximum traversal depth (default: 2)
 * @returns ExpandedContext with categorized entities
 */
export function expandDependencies(
  graph: DependencyGraph,
  seedIds: string[],
  maxDepth: number = 2
): ExpandedContext {
  const visited = new Set<string>();
  const primary: CodeEntity[] = [];
  const dependencies: CodeEntity[] = [];
  const dependents: CodeEntity[] = [];
  const types: CodeEntity[] = [];

  // Queue: [entityId, depth, relationship]
  type QueueItem = [string, number, 'primary' | 'dependency' | 'dependent'];
  const queue: QueueItem[] = seedIds.map(id => [id, 0, 'primary']);

  while (queue.length > 0) {
    const [entityId, depth, relationship] = queue.shift()!;

    // Skip if already visited
    if (visited.has(entityId)) continue;
    visited.add(entityId);

    // Get the entity
    const entity = graph.entities.get(entityId);
    if (!entity) continue;

    // Categorize based on relationship and type
    if (entity.type === 'interface' || entity.type === 'type') {
      types.push(entity);
    } else if (relationship === 'primary') {
      primary.push(entity);
    } else if (relationship === 'dependency') {
      dependencies.push(entity);
    } else if (relationship === 'dependent') {
      dependents.push(entity);
    }

    // Don't expand beyond max depth
    if (depth >= maxDepth) continue;

    // Add dependencies (what this entity calls)
    const callIds = graph.calls.get(entityId) || new Set();
    for (const callId of callIds) {
      if (!visited.has(callId)) {
        queue.push([callId, depth + 1, 'dependency']);
      }
    }

    // Add dependents only for primary matches (depth 0)
    // This prevents explosion - we only care about immediate callers
    if (depth === 0) {
      const callerIds = graph.calledBy.get(entityId) || new Set();
      for (const callerId of callerIds) {
        if (!visited.has(callerId)) {
          queue.push([callerId, depth + 1, 'dependent']);
        }
      }
    }
  }

  return { primary, dependencies, dependents, types };
}

// ----------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * findEntitiesByName - Find all entities matching a name
 * 
 * @param graph - The dependency graph
 * @param name - Function/class name to search for
 * @returns Array of matching CodeEntity objects
 */
export function findEntitiesByName(
  graph: DependencyGraph,
  name: string
): CodeEntity[] {
  const ids = graph.nameToIds.get(name) || [];
  return ids
    .map(id => graph.entities.get(id))
    .filter((e): e is CodeEntity => e !== undefined);
}

/**
 * getGraphStats - Get statistics about the dependency graph
 * 
 * @param graph - The dependency graph
 * @returns Statistics object
 */
export function getGraphStats(graph: DependencyGraph): {
  totalEntities: number;
  totalEdges: number;
  avgDependencies: number;
  avgDependents: number;
  mostCalled: { name: string; count: number }[];
  mostDependencies: { name: string; count: number }[];
} {
  let totalEdges = 0;
  let totalDeps = 0;
  let totalDependents = 0;

  const calledCounts: Map<string, number> = new Map();
  const depCounts: Map<string, number> = new Map();

  for (const [id, callSet] of graph.calls) {
    const count = callSet.size;
    totalEdges += count;
    totalDeps += count;
    const entity = graph.entities.get(id);
    if (entity) {
      depCounts.set(entity.name, count);
    }
  }

  for (const [id, callerSet] of graph.calledBy) {
    totalDependents += callerSet.size;
    const entity = graph.entities.get(id);
    if (entity) {
      calledCounts.set(entity.name, callerSet.size);
    }
  }

  const entityCount = graph.entities.size;

  // Top 5 most called
  const mostCalled = [...calledCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Top 5 most dependencies
  const mostDependencies = [...depCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    totalEntities: entityCount,
    totalEdges,
    avgDependencies: entityCount > 0 ? totalDeps / entityCount : 0,
    avgDependents: entityCount > 0 ? totalDependents / entityCount : 0,
    mostCalled,
    mostDependencies,
  };
}

/**
 * getCallChain - Find path from one entity to another
 * 
 * Uses BFS to find the shortest call chain.
 * 
 * @param graph - The dependency graph
 * @param fromId - Starting entity ID
 * @param toId - Target entity ID
 * @returns Array of entity IDs forming the path, or null if no path
 */
export function getCallChain(
  graph: DependencyGraph,
  fromId: string,
  toId: string
): string[] | null {
  if (fromId === toId) return [fromId];

  const visited = new Set<string>();
  const queue: [string, string[]][] = [[fromId, [fromId]]];

  while (queue.length > 0) {
    const [current, path] = queue.shift()!;

    if (visited.has(current)) continue;
    visited.add(current);

    const calls = graph.calls.get(current) || new Set();
    for (const nextId of calls) {
      const newPath = [...path, nextId];
      
      if (nextId === toId) {
        return newPath;
      }

      if (!visited.has(nextId)) {
        queue.push([nextId, newPath]);
      }
    }
  }

  return null; // No path found
}
