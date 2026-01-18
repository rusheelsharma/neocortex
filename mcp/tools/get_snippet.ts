// ============================================================================
// FILE: mcp/tools/get_snippet.ts
// PURPOSE: Get exact code from a specific file and line range
// ============================================================================

import { Tool, SchemaConstraint, Optional } from '@leanmcp/core';
import * as path from 'path';
import { store } from '../store.js';
import { 
  extractLines, 
  extractLinesWithContext,
  LineExtractionResult 
} from '../../src/extractor.js';

/**
 * Input schema for get_snippet tool
 */
class GetSnippetInput {
  @SchemaConstraint({
    description: 'Repository ID returned from index_repo'
  })
  repo_id!: string;

  @SchemaConstraint({
    description: 'Path to the file (relative to repo root)'
  })
  file_path!: string;

  @SchemaConstraint({
    description: 'Starting line number (1-indexed)',
    minimum: 1
  })
  start_line!: number;

  @SchemaConstraint({
    description: 'Ending line number (1-indexed, inclusive)',
    minimum: 1
  })
  end_line!: number;

  @Optional()
  @SchemaConstraint({
    description: 'Number of context lines to include before and after (default: 0)',
    default: 0,
    minimum: 0,
    maximum: 20
  })
  context_lines?: number;
}

/**
 * GetSnippetService - Extract exact code by file and line range
 * 
 * Uses the extractor module from src/ for robust line extraction
 * with optional context lines around the requested range.
 */
export class GetSnippetService {
  @Tool({
    description: 'Get exact code from a specific file and line range. Useful when you know exactly where code is located from previous search results. Optionally include surrounding context lines.',
    inputClass: GetSnippetInput
  })
  async get_snippet(input: GetSnippetInput) {
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

      // Validate line numbers
      if (input.end_line < input.start_line) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'error',
              error: 'end_line must be greater than or equal to start_line'
            }, null, 2)
          }],
          isError: true
        };
      }

      // Construct full file path
      const fullPath = path.join(repo.localPath, input.file_path);
      const contextLines = input.context_lines ?? 0;

      // Use the extractor module for line extraction
      let result: LineExtractionResult;
      try {
        if (contextLines > 0) {
          result = await extractLinesWithContext(
            fullPath, 
            input.start_line, 
            input.end_line, 
            contextLines
          );
        } else {
          result = await extractLines(fullPath, input.start_line, input.end_line);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'error',
                error: `File not found: ${input.file_path}`,
                hint: 'Check the file path is correct and relative to repo root'
              }, null, 2)
            }],
            isError: true
          };
        }
        
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'error',
              error: errorMessage
            }, null, 2)
          }],
          isError: true
        };
      }

      // Estimate tokens (4 chars per token approximation)
      const tokens = Math.ceil(result.content.length / 4);

      // Build response
      const response: Record<string, unknown> = {
        status: 'success',
        file_path: input.file_path,
        start_line: result.startLine,
        end_line: result.endLine,
        total_lines_in_file: result.totalLinesInFile,
        code: result.lines.join('\n'),
        formatted_code: result.content,
        tokens
      };

      // Add context info if context was requested
      if (contextLines > 0) {
        response.context_lines_included = contextLines;
        response.original_range = {
          start: input.start_line,
          end: input.end_line
        };
      }

      // Add note if end_line was adjusted
      if (result.endLine !== input.end_line && contextLines === 0) {
        response.note = `Adjusted end_line from ${input.end_line} to ${result.endLine} (file has ${result.totalLinesInFile} lines)`;
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(response, null, 2)
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
  private getDemoResponse(input: GetSnippetInput) {
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: 'demo_mode',
          file_path: input.file_path,
          start_line: input.start_line,
          end_line: input.end_line,
          code: `// Demo code snippet\nexport function example() {\n  return 'Hello, World!';\n}`,
          formatted_code: `  ${input.start_line} | // Demo code snippet\n  ${input.start_line + 1} | export function example() {\n  ${input.start_line + 2} |   return 'Hello, World!';\n  ${input.start_line + 3} | }`,
          tokens: 25,
          message: 'Demo mode - returning example response'
        }, null, 2)
      }]
    };
  }
}
