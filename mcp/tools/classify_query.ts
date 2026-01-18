// ============================================================================
// FILE: mcp/tools/classify_query.ts
// PURPOSE: Analyze and classify user queries to understand intent
// ============================================================================

import { Tool, SchemaConstraint } from '@leanmcp/core';
import { 
  classifyQuery, 
  getSearchStrategy,
  QueryAnalysis,
  SearchStrategy 
} from '../../src/retrieval/classifier.js';

/**
 * Input schema for classify_query tool
 */
class ClassifyQueryInput {
  @SchemaConstraint({
    description: 'The query to classify (e.g., "how does authentication work", "difference between login and signup")'
  })
  query!: string;
}

/**
 * ClassifyQueryService - Analyze queries to understand intent
 * 
 * This tool helps understand what type of question is being asked
 * and provides optimal search parameters. Useful for:
 * - Understanding query complexity before searching
 * - Debugging why certain searches return unexpected results
 * - Optimizing search parameters for specific query types
 */
export class ClassifyQueryService {
  @Tool({
    description: 'Analyze a query to understand its type (simple, multi-hop, debugging, architectural, comparative, usage, or line extraction). Returns classification details and recommended search parameters. Use this to understand query intent before searching.',
    inputClass: ClassifyQueryInput
  })
  async classify_query(input: ClassifyQueryInput) {
    try {
      // Classify the query
      const analysis = classifyQuery(input.query);
      const strategy = getSearchStrategy(analysis);

      // Format confidence as percentage
      const confidencePercent = Math.round(analysis.confidence * 100);

      // Build human-readable explanation
      const typeExplanations: Record<string, string> = {
        'simple': 'A straightforward question about a single concept or entity',
        'multi-hop': 'A question requiring following connections between multiple entities',
        'architectural': 'A question about overall structure, design, or organization',
        'comparative': 'A question comparing two or more entities or concepts',
        'debugging': 'A question about errors, failures, or unexpected behavior',
        'usage': 'A question about how to use or call a specific function/class',
        'line': 'A request for specific lines from a file'
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'success',
            query: input.query,
            classification: {
              type: analysis.type,
              type_description: typeExplanations[analysis.type],
              confidence: `${confidencePercent}%`,
              confidence_raw: analysis.confidence,
              reason: analysis.reason
            },
            extracted: {
              targets: analysis.targets.length > 0 ? analysis.targets : '(none detected)',
              keywords: analysis.keywords.length > 0 ? analysis.keywords : '(none detected)'
            },
            recommended_search_params: {
              top_k: strategy.topK,
              graph_depth: strategy.graphDepth,
              min_score: strategy.minScore,
              include_callers: strategy.includeCallers,
              include_callees: strategy.includeCallees,
              boost_entry_points: strategy.boostEntryPoints,
              boost_types: strategy.boostTypes,
              keyword_boost: strategy.keywordBoost
            },
            tips: this.getTipsForQueryType(analysis.type)
          }, null, 2)
        }]
      };
    } catch (error) {
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
   * getTipsForQueryType - Return helpful tips for each query type
   */
  private getTipsForQueryType(type: string): string[] {
    const tips: Record<string, string[]> = {
      'simple': [
        'Use search_code with default parameters for best results',
        'Include specific function or class names for more precise matches',
        'Try adding quotes around exact names like "authenticateUser"'
      ],
      'multi-hop': [
        'Enable dependency expansion (expand_deps: true) to follow call chains',
        'Consider increasing k to see more intermediate connections',
        'Mention both source and destination entities in your query'
      ],
      'architectural': [
        'Search results will include entry points and type definitions',
        'Use broader terms like "structure", "overview", or "main components"',
        'Results will prioritize highly-connected code entities'
      ],
      'comparative': [
        'Mention both entities you want to compare explicitly',
        'Results will include callers to show usage patterns',
        'Try searching for each entity separately if comparison is unclear'
      ],
      'debugging': [
        'Include error messages or symptoms in your query',
        'Results will follow the call chain to find error sources',
        'Consider using get_snippet to see more context around errors'
      ],
      'usage': [
        'Mention the function or class name you want to use',
        'Results focus on the target function and what it calls',
        'Look at the parameters and return types in the results'
      ],
      'line': [
        'Use get_snippet tool instead for line-specific requests',
        'Specify file path and line numbers directly',
        'Format: get_snippet with file_path and start_line/end_line'
      ]
    };

    return tips[type] || ['Use search_code with your query to find relevant code'];
  }
}
