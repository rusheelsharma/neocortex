// ============================================================================
// FILE: mcp/tools/resolve_symbol.ts
// PURPOSE: Find all definitions of a symbol by exact name
// ============================================================================

import { Tool, SchemaConstraint } from '@leanmcp/core';
import { store } from '../store.js';
import { findEntitiesByName } from '../../src/graph.js';
import { CodeEntity } from '../../src/types.js';

/**
 * Input schema for resolve_symbol tool
 */
class ResolveSymbolInput {
  @SchemaConstraint({
    description: 'Repository ID returned from index_repo'
  })
  repo_id!: string;

  @SchemaConstraint({
    description: 'Symbol name to find (function, class, interface, or type name)'
  })
  symbol!: string;
}

/**
 * SymbolDefinition - A single symbol definition
 */
interface SymbolDefinition {
  name: string;
  type: string;
  file: string;
  startLine: number;
  endLine: number;
  signature: string;
  docstring: string | null;
  code: string;
}

/**
 * ResolveSymbolService - Exact symbol lookup
 */
export class ResolveSymbolService {
  @Tool({
    description: 'Find all definitions of a symbol (function, class, interface, or type) by exact name. Returns full code and metadata for each definition found.',
    inputClass: ResolveSymbolInput
  })
  async resolve_symbol(input: ResolveSymbolInput) {
    try {
      const repo = store.get(input.repo_id);

      if (!repo) {
        if (process.env.DEMO_MODE === 'true') {
          return this.getDemoResponse(input);
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'error',
              error: `Repository not found: ${input.repo_id}`,
              hint: 'Call index_repo first to index the repository'
            }, null, 2)
          }],
          isError: true
        };
      }

      // Find entities by exact name match
      const entities = findEntitiesByName(repo.graph, input.symbol);

      // Also search for partial matches if no exact matches
      let partialMatches: CodeEntity[] = [];
      if (entities.length === 0) {
        const symbolLower = input.symbol.toLowerCase();
        partialMatches = repo.entities.filter(e => {
          const nameLower = e.name.toLowerCase();
          const baseName = nameLower.split('.').pop() || nameLower;
          return baseName.includes(symbolLower) || symbolLower.includes(baseName);
        }).slice(0, 10);
      }

      if (entities.length === 0 && partialMatches.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'not_found',
              symbol: input.symbol,
              message: `No definitions found for symbol: ${input.symbol}`,
              suggestion: 'Check spelling or use search_code for fuzzy search'
            }, null, 2)
          }]
        };
      }

      // Format definitions
      const definitions: SymbolDefinition[] = entities.map(entity => ({
        name: entity.name,
        type: entity.type,
        file: entity.file,
        startLine: entity.startLine,
        endLine: entity.endLine,
        signature: entity.signature,
        docstring: entity.docstring,
        code: entity.code
      }));

      const partialDefinitions: SymbolDefinition[] = partialMatches.map(entity => ({
        name: entity.name,
        type: entity.type,
        file: entity.file,
        startLine: entity.startLine,
        endLine: entity.endLine,
        signature: entity.signature,
        docstring: entity.docstring,
        code: entity.code
      }));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'success',
            symbol: input.symbol,
            exact_matches: definitions.length,
            definitions: definitions,
            ...(partialMatches.length > 0 && {
              partial_matches: partialDefinitions.length,
              similar_symbols: partialDefinitions
            })
          }, null, 2)
        }]
      };
    } catch (error) {
      if (process.env.DEMO_MODE === 'true') {
        return this.getDemoResponse(input);
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  /**
   * getDemoResponse - Return stub response for demo mode
   */
  private getDemoResponse(input: ResolveSymbolInput) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: 'demo_mode',
          symbol: input.symbol,
          exact_matches: 1,
          definitions: [{
            name: input.symbol,
            type: 'function',
            file: 'src/utils.ts',
            startLine: 10,
            endLine: 25,
            signature: `${input.symbol}(input: string): Promise<Result>`,
            docstring: `Process the input and return a result`,
            code: `async function ${input.symbol}(input: string): Promise<Result> {\n  // Implementation\n  return { success: true };\n}`
          }],
          message: 'Demo mode - returning example response'
        }, null, 2)
      }]
    };
  }
}
