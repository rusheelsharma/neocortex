// Quick test for budget.ts
import { selectWithinBudget } from './budget.js';
import { CodeEntity } from '../types.js';

// Mock entities (ranked by relevance)
const entities: Partial<CodeEntity>[] = [
  { id: '1', name: 'parseFile', file: 'parser.ts', code: 'function parseFile() { }', tokens: 100, docstring: 'Parses a file' },
  { id: '2', name: 'cloneRepo', file: 'clone.ts', code: 'function cloneRepo() { }', tokens: 80, docstring: null },
  { id: '3', name: 'bigFunction', file: 'big.ts', code: 'function big() { /* lots of code */ }', tokens: 500, docstring: 'Too big to fit' },
  { id: '4', name: 'smallHelper', file: 'utils.ts', code: 'const x = 1;', tokens: 20, docstring: 'Small helper' },
];

console.log('=== Budget Test ===\n');

// Test 1: 200 token budget
const result = selectWithinBudget(entities as CodeEntity[], 200);
console.log('Test 1: maxTokens = 200');
console.log('  Selected:', result.selected.map(e => `${e.name} (${e.tokens})`).join(', '));
console.log('  Total tokens:', result.totalTokens);
console.log('  Expected: parseFile(100), cloneRepo(80) = 180 tokens');
console.log('  (bigFunction skipped, smallHelper fits after)\n');

// Test 2: Very small budget
const result2 = selectWithinBudget(entities as CodeEntity[], 50);
console.log('Test 2: maxTokens = 50');
console.log('  Selected:', result2.selected.map(e => `${e.name} (${e.tokens})`).join(', ') || '(none)');
console.log('  Total tokens:', result2.totalTokens);
console.log('  Expected: smallHelper(20) = 20 tokens\n');

// Test 3: Large budget (all fit except bigFunction)
const result3 = selectWithinBudget(entities as CodeEntity[], 1000);
console.log('Test 3: maxTokens = 1000');
console.log('  Selected:', result3.selected.map(e => `${e.name} (${e.tokens})`).join(', '));
console.log('  Total tokens:', result3.totalTokens);
console.log('  Expected: all 4 entities = 700 tokens\n');

// Show formatted context
console.log('=== Formatted Context (Test 1) ===\n');
console.log(result.context);
