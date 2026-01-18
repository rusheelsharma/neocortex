// ============================================================================
// FILE: src/retrieval/classifier.ts
// PURPOSE: Analyze user queries and determine optimal search strategy
// ============================================================================

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

export type QueryType = 'simple' | 'multi-hop' | 'architectural' | 'comparative' | 'debugging' | 'usage';

export interface QueryAnalysis {
  type: QueryType;
  depth: number;           // Graph traversal depth
  topK: number;            // Number of candidates to retrieve
  keywords: string[];      // Extracted pattern matches from query
  targets: string[];       // Specific entities mentioned (e.g., "login", "database")
  confidence: number;      // 0-1 confidence in classification
  reason: string;          // Why this classification was chosen
}

export interface SearchStrategy {
  graphDepth: number;
  topK: number;
  minScore: number;
  keywordBoost: number;
  includeCallers: boolean;   // Include functions that call matches
  includeCallees: boolean;   // Include functions called by matches
  boostEntryPoints: boolean; // Boost highly-connected nodes
  boostTypes: boolean;       // Boost interfaces/types for architectural
}

// ----------------------------------------------------------------------------
// PATTERN DEFINITIONS
// ----------------------------------------------------------------------------

const PATTERNS = {
  comparative: [
    'difference between',
    'difference',
    'compare',
    'comparison',
    'versus',
    ' vs ',
    'similar',
    'similarity',
    'different from',
    'unlike',
    'same as',
  ],
  
  multiHop: [
    'connect',
    'connection',
    'flow',
    'flows',
    'lead to',
    'leads to',
    'through',
    'chain',
    'path',
    'eventually',
    'trigger',
    'triggers',
    'after',
    'before',
    'then',
    'reach',
    'reaches',
    'resulting in',
    'data get from',
    'calls',
    'trace',
  ],
  
  debugging: [
    'fail',
    'failure',
    'error',
    'exception',
    'bug',
    'issue',
    'break',
    'broken',
    'wrong',
    'incorrect',
    'null',
    'undefined',
    'crash',
    'debug',
    'not working',
    'unexpected',
    'edge case',
    'throws',
  ],
  
  architectural: [
    'overall',
    'architecture',
    'structure',
    'organize',
    'organized',
    'organization',
    'design',
    'pattern',
    'main component',
    'primary',
    'core',
    'overview',
    'summary',
    'high level',
    'big picture',
    'entry point',
    'starting point',
    'module',
    'layer',
    'layout',
  ],
  
  usage: [
    'how do i use',
    'how to use',
    'how to call',
    'how do i call',
    'example of',
    'example for',
    'how to implement',
    'usage of',
    'usage for',
    'how to invoke',
    'parameter',
    'parameters for',
    'argument',
    'arguments for',
    'what arguments',
    'what parameters',
  ],
  
  simple: [
    'what does',
    'how does',
    'explain',
    'what is',
    'show me',
    'find',
    'where is',
    'defined',
  ],
};

// Stop words for entity extraction
const STOP_WORDS = new Set([
  'how', 'does', 'the', 'to', 'a', 'an', 'is', 'are', 'what', 'where', 'when',
  'why', 'which', 'who', 'will', 'would', 'could', 'should', 'can', 'do',
  'this', 'that', 'these', 'those', 'it', 'its', 'i',
  'in', 'on', 'at', 'for', 'of', 'with', 'from', 'by', 'about',
  'and', 'or', 'but', 'if', 'then', 'else',
  'work', 'works', 'working', 'connect', 'connects', 'connection',
  'call', 'calls', 'calling', 'use', 'uses', 'using',
  'get', 'set', 'find', 'show', 'explain', 'describe',
  'between', 'through', 'into', 'onto', 'after', 'before',
  'function', 'method', 'class', 'file', 'code', 'codebase',
  'overall', 'main', 'primary', 'difference', 'compare', 'different',
  'might', 'cause', 'give', 'me', 'level', 'high', 'example',
  'take', 'takes', 'have', 'has', 'had', 'be', 'been', 'being',
]);

// ----------------------------------------------------------------------------
// ENTITY EXTRACTION
// ----------------------------------------------------------------------------

/**
 * Extract potential code entity names from a query
 */
export function extractTargets(query: string): string[] {
  const results: string[] = [];
  
  // 1. Find quoted strings first (exact entity names)
  const quotedMatches = query.match(/["']([^"']+)["']/g);
  if (quotedMatches) {
    for (const match of quotedMatches) {
      results.push(match.replace(/["']/g, ''));
    }
  }
  
  // 2. Find PascalCase words (likely class/interface names)
  const pascalMatches = query.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (pascalMatches) {
    results.push(...pascalMatches);
  }
  
  // 3. Find camelCase words (likely function/variable names)
  const camelMatches = query.match(/\b[a-z]+(?:[A-Z][a-z]+)+\b/g);
  if (camelMatches) {
    results.push(...camelMatches);
  }
  
  // 4. Find single PascalCase words (e.g., "Router", "Login")
  const singlePascal = query.match(/\b[A-Z][a-z]{2,}\b/g);
  if (singlePascal) {
    results.push(...singlePascal);
  }
  
  // 5. Extract remaining words after removing stop words
  const cleanQuery = query.toLowerCase().replace(/["']/g, '');
  const words = cleanQuery.split(/\s+/).filter(word => {
    return word.length > 2 && 
           !STOP_WORDS.has(word) && 
           /^[a-z]+$/.test(word);
  });
  results.push(...words);
  
  // Deduplicate (case-insensitive) and limit to 5
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const target of results) {
    const lower = target.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(target);
    }
  }
  
  return unique.slice(0, 5);
}

// ----------------------------------------------------------------------------
// PATTERN MATCHING
// ----------------------------------------------------------------------------

/**
 * Patterns that need word boundary matching (avoid substring matches)
 */
const WORD_BOUNDARY_PATTERNS = new Set([
  'then', 'after', 'before', 'calls', 'through', 'reach', 'reaches',
  'flow', 'flows', 'chain', 'path', 'trace',
]);

/**
 * Find matching patterns in a query
 */
function findPatternMatches(query: string, patterns: string[]): string[] {
  const q = query.toLowerCase();
  return patterns.filter(pattern => {
    if (WORD_BOUNDARY_PATTERNS.has(pattern)) {
      // Use word boundary regex for these patterns
      const regex = new RegExp(`\\b${pattern}\\b`);
      return regex.test(q);
    }
    return q.includes(pattern);
  });
}

// ----------------------------------------------------------------------------
// CONFIDENCE CALCULATION
// ----------------------------------------------------------------------------

/**
 * Calculate confidence score for a classification
 */
function calculateConfidence(
  query: string,
  type: QueryType,
  matchedPatterns: string[],
  targets: string[]
): number {
  let confidence = 0.5; // Base confidence
  
  // More matched patterns = higher confidence
  confidence += Math.min(matchedPatterns.length * 0.1, 0.3);
  
  // Query length factors
  const wordCount = query.split(/\s+/).length;
  
  switch (type) {
    case 'simple':
      if (wordCount < 6) confidence += 0.1;
      if (targets.length === 1) confidence += 0.1;
      break;
      
    case 'multi-hop':
      if (wordCount > 6) confidence += 0.1;
      if (targets.length >= 2) confidence += 0.15;
      break;
      
    case 'architectural':
      if (wordCount > 4) confidence += 0.1;
      if (targets.length === 0) confidence += 0.05; // General questions
      break;
      
    case 'comparative':
      if (targets.length >= 2) confidence += 0.2;
      else confidence -= 0.2; // Penalize if no clear targets
      break;
      
    case 'debugging':
      if (targets.length >= 1) confidence += 0.1;
      if (matchedPatterns.some(p => ['error', 'fail', 'bug', 'crash'].includes(p))) {
        confidence += 0.1;
      }
      break;
      
    case 'usage':
      if (targets.length >= 1) confidence += 0.15;
      if (query.toLowerCase().includes('how')) confidence += 0.05;
      break;
  }
  
  return Math.min(Math.max(confidence, 0.1), 1.0); // Clamp to 0.1-1.0
}

// ----------------------------------------------------------------------------
// MAIN CLASSIFICATION
// ----------------------------------------------------------------------------

/**
 * Classify a query and return analysis with recommended parameters
 */
export function classifyQuery(query: string): QueryAnalysis {
  const q = query.toLowerCase();
  const targets = extractTargets(query);
  
  // Check patterns in order of specificity (most specific first)
  
  // 1. COMPARATIVE - requires 2+ entities and comparison keywords
  const comparativeMatches = findPatternMatches(q, PATTERNS.comparative);
  if (comparativeMatches.length > 0 && targets.length >= 2) {
    return {
      type: 'comparative',
      depth: 2,
      topK: 20,
      keywords: comparativeMatches,
      targets,
      confidence: calculateConfidence(query, 'comparative', comparativeMatches, targets),
      reason: `Comparative pattern "${comparativeMatches[0]}" with ${targets.length} targets: [${targets.join(', ')}]`,
    };
  }
  
  // 2. MULTI-HOP - relationship/flow keywords
  const multiHopMatches = findPatternMatches(q, PATTERNS.multiHop);
  if (multiHopMatches.length > 0) {
    return {
      type: 'multi-hop',
      depth: 3,
      topK: 20,
      keywords: multiHopMatches,
      targets,
      confidence: calculateConfidence(query, 'multi-hop', multiHopMatches, targets),
      reason: `Multi-hop pattern "${multiHopMatches[0]}" detected`,
    };
  }
  
  // 3. DEBUGGING - error/failure keywords
  const debugMatches = findPatternMatches(q, PATTERNS.debugging);
  if (debugMatches.length > 0) {
    return {
      type: 'debugging',
      depth: 3,
      topK: 15,
      keywords: debugMatches,
      targets,
      confidence: calculateConfidence(query, 'debugging', debugMatches, targets),
      reason: `Debugging pattern "${debugMatches[0]}" detected`,
    };
  }
  
  // 4. ARCHITECTURAL - structure/design keywords
  const archMatches = findPatternMatches(q, PATTERNS.architectural);
  if (archMatches.length > 0) {
    return {
      type: 'architectural',
      depth: 2,
      topK: 25,
      keywords: archMatches,
      targets,
      confidence: calculateConfidence(query, 'architectural', archMatches, targets),
      reason: `Architectural pattern "${archMatches[0]}" detected`,
    };
  }
  
  // 5. USAGE - "how to use/call" patterns
  const usageMatches = findPatternMatches(q, PATTERNS.usage);
  if (usageMatches.length > 0) {
    return {
      type: 'usage',
      depth: 1,
      topK: 10,
      keywords: usageMatches,
      targets,
      confidence: calculateConfidence(query, 'usage', usageMatches, targets),
      reason: `Usage pattern "${usageMatches[0]}" detected`,
    };
  }
  
  // 6. DEFAULT: SIMPLE - basic questions
  const simpleMatches = findPatternMatches(q, PATTERNS.simple);
  return {
    type: 'simple',
    depth: 1,
    topK: 10,
    keywords: simpleMatches,
    targets,
    confidence: simpleMatches.length > 0 
      ? calculateConfidence(query, 'simple', simpleMatches, targets)
      : 0.6, // Lower confidence for true defaults
    reason: simpleMatches.length > 0
      ? `Simple pattern "${simpleMatches[0]}" detected`
      : 'No specific patterns detected, defaulting to simple query',
  };
}

// ----------------------------------------------------------------------------
// SEARCH STRATEGY
// ----------------------------------------------------------------------------

/**
 * Generate search strategy parameters based on query analysis
 */
export function getSearchStrategy(analysis: QueryAnalysis): SearchStrategy {
  // Note: OpenAI embeddings typically produce lower similarity scores (0.2-0.5 range)
  // These thresholds are calibrated for that behavior
  const base: SearchStrategy = {
    graphDepth: analysis.depth,
    topK: analysis.topK,
    minScore: 0.35,  // Base threshold for OpenAI embeddings
    keywordBoost: 0.2,
    includeCallers: false,
    includeCallees: true,
    boostEntryPoints: false,
    boostTypes: false,
  };

  switch (analysis.type) {
    case 'simple':
      return {
        ...base,
        minScore: 0.40, // Slightly higher for focused queries
      };
      
    case 'multi-hop':
      return {
        ...base,
        includeCallers: true,
        includeCallees: true,
        minScore: 0.30, // Lower threshold to find connections
      };
      
    case 'architectural':
      return {
        ...base,
        boostEntryPoints: true,
        boostTypes: true,
        includeCallers: true,
        includeCallees: true,
        keywordBoost: 0.1, // Less keyword focus, more structure
        minScore: 0.25, // Lower threshold for broad queries
      };
      
    case 'comparative':
      return {
        ...base,
        includeCallers: true,
        minScore: 0.35,
      };
      
    case 'debugging':
      return {
        ...base,
        includeCallees: true,
        keywordBoost: 0.3, // Boost error-related keywords
        minScore: 0.35,
      };
      
    case 'usage':
      return {
        ...base,
        minScore: 0.40,
        includeCallees: true,
      };
  }
}

// ----------------------------------------------------------------------------
// FORMATTING / DEBUG OUTPUT
// ----------------------------------------------------------------------------

/**
 * Format analysis for console output
 */
export function formatAnalysis(analysis: QueryAnalysis): string {
  const confidenceBar = '█'.repeat(Math.floor(analysis.confidence * 10)) + 
                        '░'.repeat(10 - Math.floor(analysis.confidence * 10));
  
  return `
┌─────────────────────────────────────────────────────────────┐
│ QUERY CLASSIFICATION                                        │
├─────────────────────────────────────────────────────────────┤
│ Type:       ${analysis.type.toUpperCase().padEnd(46)}│
│ Confidence: [${confidenceBar}] ${(analysis.confidence * 100).toFixed(0).padStart(3)}%                        │
│ Depth:      ${String(analysis.depth).padEnd(46)}│
│ TopK:       ${String(analysis.topK).padEnd(46)}│
├─────────────────────────────────────────────────────────────┤
│ Targets:    ${(analysis.targets.length > 0 ? analysis.targets.join(', ') : '(none)').slice(0, 46).padEnd(46)}│
│ Keywords:   ${(analysis.keywords.length > 0 ? analysis.keywords.slice(0, 3).join(', ') : '(none)').slice(0, 46).padEnd(46)}│
├─────────────────────────────────────────────────────────────┤
│ Reason:                                                     │
│ ${analysis.reason.slice(0, 57).padEnd(58)}│
└─────────────────────────────────────────────────────────────┘`;
}

/**
 * Format strategy for console output
 */
export function formatStrategy(strategy: SearchStrategy): string {
  const flags = [
    strategy.includeCallers ? '✓ callers' : '✗ callers',
    strategy.includeCallees ? '✓ callees' : '✗ callees',
    strategy.boostEntryPoints ? '✓ entry points' : '✗ entry points',
    strategy.boostTypes ? '✓ types' : '✗ types',
  ].join('  ');
  
  return `
┌─────────────────────────────────────────────────────────────┐
│ SEARCH STRATEGY                                             │
├─────────────────────────────────────────────────────────────┤
│ Graph Depth:   ${String(strategy.graphDepth).padEnd(43)}│
│ Top K:         ${String(strategy.topK).padEnd(43)}│
│ Min Score:     ${strategy.minScore.toFixed(2).padEnd(43)}│
│ Keyword Boost: ${strategy.keywordBoost.toFixed(2).padEnd(43)}│
├─────────────────────────────────────────────────────────────┤
│ ${flags.padEnd(58)}│
└─────────────────────────────────────────────────────────────┘`;
}
