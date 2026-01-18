// ============================================================================
// FILE: mcp/server.ts
// PURPOSE: Main MCP server entry point using LeanMCP
// ============================================================================

import dotenv from 'dotenv';
import { createHTTPServer } from '@leanmcp/core';
import path from 'path';
import { fileURLToPath } from 'url';

// Import all service classes for factory registration
import { PingService } from './tools/ping.js';
import { IndexRepoService } from './tools/index_repo.js';
import { SearchCodeService } from './tools/search_code.js';
import { ResolveSymbolService } from './tools/resolve_symbol.js';
import { GetSnippetService } from './tools/get_snippet.js';

// Load environment variables
dotenv.config();

// Get port from environment or use default
const PORT = parseInt(process.env.MCP_PORT || '3002', 10);

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    GetSnippetService: () => new GetSnippetService()
  }
});

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    🧠 Neocortex MCP Server                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Version: 1.0.0                                               ║
║  Port:    ${PORT}                                                ║
║  Mode:    ${process.env.DEMO_MODE === 'true' ? 'DEMO' : 'PRODUCTION'}                                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Available Tools:                                             ║
║    • ping          - Health check                             ║
║    • index_repo    - Clone and index a GitHub repository      ║
║    • search_code   - Search for relevant code snippets        ║
║    • resolve_symbol- Find definitions by exact name           ║
║    • get_snippet   - Get code from specific file:lines        ║
╚═══════════════════════════════════════════════════════════════╝
`);
