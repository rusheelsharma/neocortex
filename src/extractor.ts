// ============================================================================
// FILE: src/extractor.ts
// PURPOSE: Extract specific lines or ranges from files in a repository
// ============================================================================

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * LineExtractionResult - Result of extracting lines from a file
 */
export interface LineExtractionResult {
  filePath: string;
  startLine: number;
  endLine: number;
  lines: string[];
  content: string;
  totalLinesInFile: number;
}

/**
 * parseLineRange - Parse a line specification (single line or range)
 * 
 * @param lineSpec - Line specification (e.g., "45", "40-50", "10:20")
 * @returns [startLine, endLine] tuple (1-indexed)
 * 
 * Examples:
 *   "45" → [45, 45]
 *   "40-50" → [40, 50]
 *   "10:20" → [10, 20]
 */
export function parseLineRange(lineSpec: string): [number, number] {
  // Handle range with hyphen: "40-50"
  if (lineSpec.includes('-')) {
    const [start, end] = lineSpec.split('-').map(s => parseInt(s.trim(), 10));
    return [start, end];
  }
  
  // Handle range with colon: "10:20"
  if (lineSpec.includes(':')) {
    const [start, end] = lineSpec.split(':').map(s => parseInt(s.trim(), 10));
    return [start, end];
  }
  
  // Single line
  const line = parseInt(lineSpec.trim(), 10);
  return [line, line];
}

/**
 * extractLines - Extract specific lines from a file
 * 
 * @param filePath - Path to the file
 * @param startLine - Starting line number (1-indexed)
 * @param endLine - Ending line number (1-indexed, inclusive)
 * @returns LineExtractionResult with the extracted content
 */
export async function extractLines(
  filePath: string,
  startLine: number,
  endLine: number
): Promise<LineExtractionResult> {
  // Read the file
  const content = await fs.readFile(filePath, 'utf-8');
  const allLines = content.split('\n');
  const totalLinesInFile = allLines.length;

  // Validate line numbers
  if (startLine < 1) startLine = 1;
  
  // Check if requested lines exist
  if (startLine > totalLinesInFile) {
    throw new Error(`Line ${startLine} doesn't exist. File only has ${totalLinesInFile} lines.`);
  }
  
  if (endLine > totalLinesInFile) endLine = totalLinesInFile;
  if (startLine > endLine) {
    throw new Error(`Invalid line range: ${startLine}-${endLine}`);
  }

  // Extract lines (convert to 0-indexed)
  const lines = allLines.slice(startLine - 1, endLine);

  // Format with line numbers
  const formattedLines = lines.map((line, idx) => {
    const lineNum = startLine + idx;
    return `${lineNum.toString().padStart(4)} | ${line}`;
  });

  return {
    filePath,
    startLine,
    endLine,
    lines,
    content: formattedLines.join('\n'),
    totalLinesInFile,
  };
}

/**
 * extractLinesFromRepo - Extract lines from a file in a cloned repository
 * 
 * @param repoPath - Path to the cloned repository
 * @param relativeFilePath - Path to file relative to repo root
 * @param lineSpec - Line specification (e.g., "45", "40-50")
 * @returns LineExtractionResult
 */
export async function extractLinesFromRepo(
  repoPath: string,
  relativeFilePath: string,
  lineSpec: string
): Promise<LineExtractionResult> {
  const fullPath = path.join(repoPath, relativeFilePath);
  
  // Check if file exists
  try {
    await fs.access(fullPath);
  } catch {
    throw new Error(`File not found: ${relativeFilePath}`);
  }

  const [startLine, endLine] = parseLineRange(lineSpec);
  return extractLines(fullPath, startLine, endLine);
}

/**
 * extractLinesWithContext - Extract lines with surrounding context
 * 
 * @param filePath - Path to the file
 * @param startLine - Starting line number (1-indexed)
 * @param endLine - Ending line number (1-indexed)
 * @param contextLines - Number of context lines before/after (default: 3)
 * @returns LineExtractionResult with context
 */
export async function extractLinesWithContext(
  filePath: string,
  startLine: number,
  endLine: number,
  contextLines: number = 3
): Promise<LineExtractionResult> {
  const contextStart = Math.max(1, startLine - contextLines);
  const content = await fs.readFile(filePath, 'utf-8');
  const totalLines = content.split('\n').length;
  const contextEnd = Math.min(totalLines, endLine + contextLines);

  return extractLines(filePath, contextStart, contextEnd);
}

/**
 * formatExtractionResult - Format extraction result for display
 * 
 * @param result - LineExtractionResult to format
 * @returns Formatted string for console output
 */
export function formatExtractionResult(result: LineExtractionResult): string {
  const header = `
═══════════════════════════════════════════════════════════════
FILE: ${result.filePath}
LINES: ${result.startLine}-${result.endLine} (of ${result.totalLinesInFile} total)
═══════════════════════════════════════════════════════════════
`;

  return header + '\n' + result.content + '\n';
}

