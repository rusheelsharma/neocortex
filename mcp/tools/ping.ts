// ============================================================================
// FILE: mcp/tools/ping.ts
// PURPOSE: Health check tool to verify MCP server is running
// ============================================================================

import { Tool } from '@leanmcp/core';
import { store } from '../store.js';

/**
 * PingService - Simple health check service
 * 
 * Provides a ping endpoint to verify the MCP server is running
 * and returns basic status information about indexed repositories.
 */
export class PingService {
  @Tool({
    description: 'Health check - returns server status and indexed repository count. Use this to verify the MCP server is running correctly.'
  })
  async ping() {
    const repoCount = store.size;
    const totalEntities = store.getTotalEntities();
    const indexedRepos = store.list();

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: 'ok',
          message: '🧠 Neocortex MCP server is running',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          stats: {
            indexed_repositories: repoCount,
            total_entities: totalEntities,
            repository_ids: indexedRepos
          }
        }, null, 2)
      }]
    };
  }
}
