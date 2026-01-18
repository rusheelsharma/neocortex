// ============================================================================
// FILE: mcp/index.ts
// PURPOSE: Main export for MCP server module
// ============================================================================

// Re-export all tools for auto-discovery by LeanMCP
export * from './tools/index.js';

// Export store for external use
export { store, generateRepoId, type IndexedRepository } from './store.js';

// Export helpers for potential reuse
export * from './helpers/index.js';
