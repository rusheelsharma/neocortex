// src/compression/slicer.ts

/**
 * Program Slicing - Extract only query-relevant code lines
 */

const STOP_WORDS = [
  'how', 'does', 'what', 'where', 'when', 'why', 'which',
  'the', 'this', 'that', 'work', 'works', 'working',
  'can', 'could', 'would', 'should', 'is', 'are', 'was',
  'have', 'has', 'had', 'do', 'did', 'and', 'or', 'but'
];

/**
 * Extract search terms from a natural language query
 * "how does tagging work" → ["tag", "tags", "tagging"]
 */
export function extractQueryTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .filter(w => !STOP_WORDS.includes(w));

  const terms = new Set<string>();

  for (const word of words) {
    terms.add(word);

    // Handle -ing words: "tagging" → "tag", "tags"
    if (word.endsWith('ing') && word.length > 4) {
      let root = word.slice(0, -3); // "tagging" → "tagg"
      // Handle doubled consonant: "tagg" → "tag"
      if (root.length > 2 && root[root.length - 1] === root[root.length - 2]) {
        root = root.slice(0, -1);
      }
      terms.add(root);
      terms.add(root + 's');
    }
    // Handle -s words: "tags" → "tag"
    else if (word.endsWith('s') && word.length > 3) {
      terms.add(word.slice(0, -1));
    }
    // Handle base words: "tag" → "tags", "tagging"
    else {
      terms.add(word + 's');
      terms.add(word + 'ing');
    }
  }

  return Array.from(terms);
}

/**
 * Slice code to keep only lines relevant to query terms
 */
export function sliceCode(code: string, queryTerms: string[]): string {
  const lines = code.split('\n');
  const keepLines = new Set<number>();

  // RULE 1: Always keep first 2 lines (signature + opening)
  keepLines.add(0);
  if (lines.length > 1) keepLines.add(1);

  // RULE 2: Always keep last line (closing brace)
  keepLines.add(lines.length - 1);

  // RULE 3: Find lines containing query terms - use 3 lines context window
  lines.forEach((line, index) => {
    const lineLower = line.toLowerCase();

    for (const term of queryTerms) {
      if (lineLower.includes(term)) {
        // Keep 3 lines before and 3 lines after for better context
        for (let i = Math.max(0, index - 3); i <= Math.min(lines.length - 1, index + 3); i++) {
          keepLines.add(i);
        }
        break;
      }
    }
  });

  // RULE 4: If we found relevant lines, also keep variable definitions they use
  if (keepLines.size > 2) {
    const varsUsed = extractVariablesFromLines(lines, keepLines);

    lines.forEach((line, index) => {
      // Check if this line defines a variable used in relevant lines
      for (const varName of varsUsed) {
        if (
          line.includes(`const ${varName}`) ||
          line.includes(`let ${varName}`) ||
          line.includes(`var ${varName}`) ||
          line.match(new RegExp(`^\\s*${varName}\\s*=`))
        ) {
          keepLines.add(index);
          break;
        }
      }
    });
  }

  // RULE 5: If very few lines matched (< 3 content lines), return more context
  if (keepLines.size < 5 && lines.length > 5) {
    // Add some structure: opening lines and key statements
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      keepLines.add(i);
    }
    // Add return statements
    lines.forEach((line, index) => {
      if (line.trim().startsWith('return ')) {
        keepLines.add(index);
      }
    });
  }

  // Build sliced output
  const sortedLines = Array.from(keepLines).sort((a, b) => a - b);

  let result = '';
  let lastIncludedLine = -1;

  for (const lineNum of sortedLines) {
    // Add "..." indicator if we skipped lines
    if (lastIncludedLine !== -1 && lineNum > lastIncludedLine + 1) {
      result += '  // ...\n';
    }
    result += lines[lineNum] + '\n';
    lastIncludedLine = lineNum;
  }

  return result.trim();
}

/**
 * Extract variable names used in specific lines
 */
function extractVariablesFromLines(lines: string[], lineNums: Set<number>): string[] {
  const vars = new Set<string>();

  for (const num of lineNums) {
    if (num >= 0 && num < lines.length) {
      // Match word characters that look like variable names
      const matches = lines[num].match(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g) || [];

      for (const match of matches) {
        // Filter out keywords and short names
        if (match.length > 2 && !isKeyword(match)) {
          vars.add(match);
        }
      }
    }
  }

  return Array.from(vars);
}

/**
 * Check if a word is a JavaScript/TypeScript keyword
 */
function isKeyword(word: string): boolean {
  const keywords = [
    'const', 'let', 'var', 'function', 'return', 'if', 'else',
    'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'try', 'catch', 'finally', 'throw', 'new', 'this', 'class',
    'extends', 'import', 'export', 'default', 'from', 'async',
    'await', 'true', 'false', 'null', 'undefined', 'typeof',
    'instanceof', 'void', 'delete', 'in', 'of'
  ];
  return keywords.includes(word);
}

/**
 * Estimate token count (rough: 1 token ≈ 4 chars)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Slice result with metadata
 */
export interface SliceResult {
  originalCode: string;
  slicedCode: string;
  originalTokens: number;
  slicedTokens: number;
  reductionPercent: number;
  queryTermsFound: string[];
}

/**
 * Slice code and return detailed result
 */
export function sliceCodeWithStats(
  code: string,
  queryTerms: string[]
): SliceResult {
  const slicedCode = sliceCode(code, queryTerms);
  const originalTokens = estimateTokens(code);
  const slicedTokens = estimateTokens(slicedCode);

  // Find which query terms were actually found
  const codeLower = code.toLowerCase();
  const queryTermsFound = queryTerms.filter(term => codeLower.includes(term));

  return {
    originalCode: code,
    slicedCode,
    originalTokens,
    slicedTokens,
    reductionPercent: Math.round((1 - slicedTokens / originalTokens) * 100),
    queryTermsFound
  };
}

