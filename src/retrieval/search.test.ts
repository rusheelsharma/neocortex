// Quick test for search.ts
import { improvedSearch } from './search.js';
import { buildDependencyGraph } from '../graph.js';
import { CodeEntity } from '../types.js';

// Mock entities
const entities: CodeEntity[] = [
  {
    id: '1', name: 'authenticate', type: 'function', file: 'auth.ts',
    code: 'function authenticate(user, pass) { return validateToken(user); }',
    signature: 'authenticate(user, pass)', docstring: 'Authenticates a user',
    tokens: 100, complexity: 2, calls: ['validateToken'], parameters: [],
    returnType: 'User', startLine: 1, endLine: 5
  },
  {
    id: '2', name: 'validateToken', type: 'function', file: 'auth.ts',
    code: 'function validateToken(token) { return parseJWT(token); }',
    signature: 'validateToken(token)', docstring: 'Validates JWT token',
    tokens: 80, complexity: 1, calls: ['parseJWT'], parameters: [],
    returnType: 'boolean', startLine: 10, endLine: 14
  },
  {
    id: '3', name: 'parseJWT', type: 'function', file: 'utils.ts',
    code: 'function parseJWT(token) { return JSON.parse(atob(token)); }',
    signature: 'parseJWT(token)', docstring: null,
    tokens: 60, complexity: 1, calls: [], parameters: [],
    returnType: 'object', startLine: 1, endLine: 3
  },
  {
    id: '4', name: 'loginHandler', type: 'function', file: 'routes.ts',
    code: 'function loginHandler(req, res) { authenticate(req.body); }',
    signature: 'loginHandler(req, res)', docstring: 'Handles login requests',
    tokens: 120, complexity: 3, calls: ['authenticate'], parameters: [],
    returnType: 'void', startLine: 1, endLine: 10
  },
  {
    id: '5', name: 'get', type: 'function', file: 'utils.ts',
    code: 'function get(obj, key) { return obj[key]; }',
    signature: 'get(obj, key)', docstring: 'Generic getter',
    tokens: 30, complexity: 1, calls: [], parameters: [],
    returnType: 'any', startLine: 5, endLine: 7
  },
  {
    id: '6', name: 'fetchUsers', type: 'function', file: 'api.ts',
    code: 'function fetchUsers() { return fetch("/api/users"); }',
    signature: 'fetchUsers()', docstring: 'Fetches users from API',
    tokens: 50, complexity: 1, calls: [], parameters: [],
    returnType: 'Promise', startLine: 1, endLine: 3
  },
] as CodeEntity[];

// Build graph
const graph = buildDependencyGraph(entities);

// Mock semantic scores (simulating embeddings search)
const semanticScores = new Map<string, number>([
  ['1', 0.85],  // authenticate - high
  ['2', 0.72],  // validateToken - medium-high
  ['3', 0.55],  // parseJWT - medium
  ['4', 0.68],  // loginHandler - medium-high
  ['5', 0.52],  // get - low (generic)
  ['6', 0.45],  // fetchUsers - below threshold
]);

console.log('=== Improved Search Test ===\n');

// Test 1: Auth query
console.log('Test 1: "how does authentication work"');
const results1 = improvedSearch(
  'how does authentication work',
  entities,
  graph,
  semanticScores,
  { topK: 5, minScore: 0.5 }
);

console.log('Results:');
results1.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.entity.name} (${r.matchType}) - score: ${r.score.toFixed(2)}`);
});
console.log('Expected: authenticate (keyword), validateToken, loginHandler (keyword), parseJWT\n');

// Test 2: Generic "get" should be filtered
console.log('Test 2: Check "get" function filtering');
const hasGet = results1.some(r => r.entity.name === 'get');
console.log(`  "get" included: ${hasGet} (expected: false - generic name with low score)\n`);

// Test 3: Graph expansion
console.log('Test 3: Graph expansion');
console.log('  authenticate calls: validateToken');
console.log('  validateToken calls: parseJWT');
console.log('  loginHandler calls: authenticate');
const hasParsJWT = results1.some(r => r.entity.name === 'parseJWT');
console.log(`  parseJWT included via graph: ${hasParsJWT}\n`);

// Test 4: Below threshold
console.log('Test 4: Below minScore threshold');
const hasFetchUsers = results1.some(r => r.entity.name === 'fetchUsers');
console.log(`  fetchUsers (score 0.45) included: ${hasFetchUsers} (expected: false)\n`);

// Test 5: API query with synonym expansion
console.log('Test 5: "api endpoint" query');
const semanticScores2 = new Map<string, number>([
  ['1', 0.40],
  ['2', 0.35],
  ['3', 0.30],
  ['4', 0.55],
  ['5', 0.45],
  ['6', 0.75],  // fetchUsers high for API query
]);

const results2 = improvedSearch(
  'api endpoint',
  entities,
  graph,
  semanticScores2,
  { topK: 3, minScore: 0.5 }
);

console.log('Results:');
results2.forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.entity.name} (${r.matchType}) - score: ${r.score.toFixed(2)}`);
});
console.log('Expected: fetchUsers (keyword match for "api/fetch")\n');

console.log('=== All tests complete ===');
