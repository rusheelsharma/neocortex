// ============================================================================
// FILE: mcp/main.ts
// PURPOSE: Main MCP server entry point using LeanMCP
// ============================================================================

import dotenv from 'dotenv';
import { createHTTPServer } from '@leanmcp/core';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root (parent of mcp/)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import all service classes for factory registration
import { PingService } from './tools/ping.js';
import { IndexRepoService } from './tools/index_repo.js';
import { SearchCodeService } from './tools/search_code.js';
import { ResolveSymbolService } from './tools/resolve_symbol.js';
import { GetSnippetService } from './tools/get_snippet.js';
import { ClassifyQueryService } from './tools/classify_query.js';

// Get port from environment or use default
const PORT = parseInt(process.env.MCP_PORT || '3002', 10);

// Create server with service factories for manual registration
await createHTTPServer({
  name: 'neocortex-mcp',
  version: '1.0.0',
  port: PORT,
  cors: true,
  logging: true,
  mcpDir: path.join(__dirname, 'tools'),
  serviceFactories: {
    PingService: () => new PingService(),
    IndexRepoService: () => new IndexRepoService(),
    SearchCodeService: () => new SearchCodeService(),
    ResolveSymbolService: () => new ResolveSymbolService(),
    GetSnippetService: () => new GetSnippetService(),
    ClassifyQueryService: () => new ClassifyQueryService()
  }
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    Neocortex MCP Server                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Version: 1.0.0                                               ║
║  Port:    ${PORT}                                             ║
║  Mode:    ${process.env.DEMO_MODE === 'true' ?                
            'DEMO' : 'PRODUCTION'}                              ║
╠═══════════════════════════════════════════════════════════════╣
║  Available Tools:                                             ║
║    • ping           - Health check                            ║
║    • index_repo     - Clone and index a GitHub repository     ║
║    • search_code    - Search for relevant code snippets       ║
║    • resolve_symbol - Find definitions by exact name          ║
║    • get_snippet    - Get code from specific file:lines       ║
║    • classify_query - Analyze query intent and type           ║
╚═══════════════════════════════════════════════════════════════╝
`);
