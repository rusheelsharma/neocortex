// ============================================================================
// FILE: mcp/store.ts
// PURPOSE: In-memory store for indexed repositories with semantic embeddings
// ============================================================================

import { CodeEntity } from '../src/types.js';
import { DependencyGraph } from '../src/graph.js';
import { VectorStore } from '../src/embeddings.js';

/**
 * IndexedRepository - A fully indexed repository ready for querying
 * 
 * @property repoId - Unique identifier for this indexed repo
 * @property repoUrl - Original GitHub URL
 * @property localPath - Path where repo was cloned
 * @property gitSha - Git commit SHA at time of indexing
 * @property entities - All parsed code entities
 * @property graph - Dependency graph built from entities
 * @property vectorStore - Semantic embeddings for entities (optional, requires API key)
 * @property indexedAt - Timestamp when indexing completed
 */
export interface IndexedRepository {
  repoId: string;
  repoUrl: string;
  localPath: string;
  gitSha: string;
  entities: CodeEntity[];
  graph: DependencyGraph;
  vectorStore: VectorStore | null;  // null if embeddings not generated
  indexedAt: Date;
  sessionId?: string;  // Session ID for LeanMCP observability
}

/**
 * RepoStore - Singleton store for all indexed repositories
 * 
 * Provides thread-safe access to indexed repositories with simple
 * CRUD operations. Uses Map for O(1) lookups by repoId.
 */
class RepoStore {
  private repos: Map<string, IndexedRepository> = new Map();
  private static instance: RepoStore;

  private constructor() {}

  /**
   * getInstance - Get the singleton store instance
   */
  static getInstance(): RepoStore {
    if (!RepoStore.instance) {
      RepoStore.instance = new RepoStore();
    }
    return RepoStore.instance;
  }

  /**
   * add - Add an indexed repository to the store
   */
  add(repo: IndexedRepository): void {
    this.repos.set(repo.repoId, repo);
  }

  /**
   * get - Retrieve a repository by ID
   */
  get(repoId: string): IndexedRepository | undefined {
    return this.repos.get(repoId);
  }

  /**
   * has - Check if a repository exists
   */
  has(repoId: string): boolean {
    return this.repos.has(repoId);
  }

  /**
   * remove - Remove a repository from the store
   */
  remove(repoId: string): boolean {
    return this.repos.delete(repoId);
  }

  /**
   * list - List all indexed repository IDs
   */
  list(): string[] {
    return Array.from(this.repos.keys());
  }

  /**
   * getByUrl - Find a repository by its original URL
   */
  getByUrl(repoUrl: string): IndexedRepository | undefined {
    for (const repo of this.repos.values()) {
      if (repo.repoUrl === repoUrl) {
        return repo;
      }
    }
    return undefined;
  }

  /**
   * getTotalEntities - Get total entities across all repos
   */
  getTotalEntities(): number {
    let total = 0;
    for (const repo of this.repos.values()) {
      total += repo.entities.length;
    }
    return total;
  }

  /**
   * clear - Clear all repositories (useful for testing)
   */
  clear(): void {
    this.repos.clear();
  }

  /**
   * size - Get number of indexed repositories
   */
  get size(): number {
    return this.repos.size;
  }
}

// Export singleton instance
export const store = RepoStore.getInstance();

/**
 * generateRepoId - Generate a unique repository ID
 * 
 * Uses the repo name plus a timestamp suffix for uniqueness.
 * Example: "shadcn-ui-1705520400000"
 */
export function generateRepoId(repoUrl: string): string {
  // Extract repo name from URL
  const cleaned = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
  const parts = cleaned.split(/[\/:]/).filter(Boolean);
  const owner = parts[parts.length - 2] || 'unknown';
  const repo = parts[parts.length - 1] || 'repo';
  
  // Add timestamp for uniqueness
  const timestamp = Date.now();
  return `${owner}-${repo}-${timestamp}`;
}
