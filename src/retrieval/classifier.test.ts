// ============================================================================
// FILE: src/retrieval/classifier.test.ts
// PURPOSE: Test query classifier functionality
// RUN: npx tsx src/retrieval/classifier.test.ts
// ============================================================================

import {
  classifyQuery,
  getSearchStrategy,
  extractTargets,
  formatAnalysis,
  formatStrategy,
  QueryType,
} from './classifier.js';

// ----------------------------------------------------------------------------
// TEST CASES
// ----------------------------------------------------------------------------

interface TestCase {
  query: string;
  expected: QueryType;
  minConfidence?: number;
}

const testCases: TestCase[] = [
  // SIMPLE queries
  { query: 'what does login do', expected: 'simple' },
  { query: 'how does authentication work', expected: 'simple' },
  { query: 'explain the Router', expected: 'simple' },
  { query: 'what is UserService', expected: 'simple' },
  { query: 'show me the config', expected: 'simple' },
  { query: 'find the main function', expected: 'simple' },
  { query: 'where is handleSubmit defined', expected: 'simple' },
  
  // MULTI-HOP queries
  { query: 'how does login connect to the database', expected: 'multi-hop' },
  { query: 'trace the flow from input to output', expected: 'multi-hop' },
  { query: 'what happens after user clicks submit', expected: 'multi-hop' },
  { query: 'how does data flow through the app', expected: 'multi-hop' },
  { query: 'how does authentication eventually reach the database', expected: 'multi-hop' },
  { query: 'what triggers the save function', expected: 'multi-hop' },
  { query: 'trace from API call to database write', expected: 'multi-hop' },
  
  // ARCHITECTURAL queries
  { query: "what's the overall architecture", expected: 'architectural' },
  { query: 'explain the main components', expected: 'architectural' },
  { query: 'how is the codebase organized', expected: 'architectural' },
  { query: 'give me a high level overview', expected: 'architectural' },
  { query: 'what are the entry points', expected: 'architectural' },
  { query: 'describe the module structure', expected: 'architectural' },
  { query: 'explain the design pattern used', expected: 'architectural' },
  
  // COMPARATIVE queries
  { query: 'difference between login and signup', expected: 'comparative' },
  { query: 'compare UserService and AuthService', expected: 'comparative' },
  { query: 'how is login different from register', expected: 'comparative' },
  { query: 'LoginForm vs SignupForm', expected: 'comparative' },
  { query: 'what are the similarities between read and write', expected: 'comparative' },
  
  // DEBUGGING queries
  { query: 'why might authentication fail', expected: 'debugging' },
  { query: 'what could cause a null error here', expected: 'debugging' },
  { query: 'debug the token validation', expected: 'debugging' },
  { query: 'why is login not working', expected: 'debugging' },
  { query: 'what happens if the API throws an exception', expected: 'debugging' },
  { query: 'edge cases in the validator', expected: 'debugging' },
  { query: 'handleError function bug', expected: 'debugging' },
  
  // USAGE queries
  { query: 'how do I use the login function', expected: 'usage' },
  { query: 'what parameters does fetchUser take', expected: 'usage' },
  { query: 'show me an example of calling the API', expected: 'usage' },
  { query: 'how to call the authenticate method', expected: 'usage' },
  { query: 'usage of the Router class', expected: 'usage' },
  { query: 'what arguments does createUser take', expected: 'usage' },
];

// ----------------------------------------------------------------------------
// TEST RUNNER
// ----------------------------------------------------------------------------

function runTests(): void {
  console.log('\n🧪 Query Classifier Tests\n');
  console.log('═'.repeat(70));
  
  let passed = 0;
  let failed = 0;
  const failures: { query: string; expected: QueryType; actual: QueryType }[] = [];
  
  for (const testCase of testCases) {
    const analysis = classifyQuery(testCase.query);
    const isCorrect = analysis.type === testCase.expected;
    
    if (isCorrect) {
      passed++;
      console.log(`✅ "${testCase.query.slice(0, 45).padEnd(45)}" → ${analysis.type}`);
    } else {
      failed++;
      failures.push({
        query: testCase.query,
        expected: testCase.expected,
        actual: analysis.type,
      });
      console.log(`❌ "${testCase.query.slice(0, 45).padEnd(45)}" → ${analysis.type} (expected: ${testCase.expected})`);
    }
  }
  
  console.log('═'.repeat(70));
  console.log(`\n📊 Results: ${passed}/${testCases.length} passed (${((passed / testCases.length) * 100).toFixed(1)}%)\n`);
  
  if (failures.length > 0) {
    console.log('❌ FAILURES:\n');
    for (const f of failures) {
      console.log(`   Query:    "${f.query}"`);
      console.log(`   Expected: ${f.expected}`);
      console.log(`   Actual:   ${f.actual}`);
      
      // Show analysis for debugging
      const analysis = classifyQuery(f.query);
      console.log(`   Reason:   ${analysis.reason}`);
      console.log(`   Keywords: [${analysis.keywords.join(', ')}]`);
      console.log(`   Targets:  [${analysis.targets.join(', ')}]`);
      console.log('');
    }
  }
}

// ----------------------------------------------------------------------------
// INTERACTIVE DEMO
// ----------------------------------------------------------------------------

function runDemo(): void {
  console.log('\n🎯 Query Classifier Demo\n');
  console.log('═'.repeat(70));
  
  const demoQueries = [
    'how does login connect to the database',
    'what does the Router class do',
    'compare UserService and AuthService',
    'why might the API fail',
    "what's the overall architecture of this project",
    'how do I use fetchUser',
  ];
  
  for (const query of demoQueries) {
    console.log(`\n📝 Query: "${query}"\n`);
    
    const analysis = classifyQuery(query);
    const strategy = getSearchStrategy(analysis);
    
    console.log(formatAnalysis(analysis));
    console.log(formatStrategy(strategy));
  }
}

// ----------------------------------------------------------------------------
// TARGET EXTRACTION TEST
// ----------------------------------------------------------------------------

function testTargetExtraction(): void {
  console.log('\n🎯 Target Extraction Tests\n');
  console.log('═'.repeat(70));
  
  const cases = [
    { query: 'how does login connect to database', expected: ['login', 'database'] },
    { query: 'compare UserService and AuthService', expected: ['UserService', 'AuthService'] },
    { query: 'what does "fetchUser" do', expected: ['fetchUser'] },
    { query: 'explain the handleSubmit function', expected: ['handleSubmit'] },
    { query: 'trace from createOrder to sendEmail', expected: ['createOrder', 'sendEmail'] },
    { query: 'what is the overall architecture', expected: [] }, // No specific entities
  ];
  
  for (const c of cases) {
    const targets = extractTargets(c.query);
    const hasExpected = c.expected.every(e => 
      targets.some(t => t.toLowerCase() === e.toLowerCase())
    );
    
    const status = hasExpected ? '✅' : '❌';
    console.log(`${status} "${c.query}"`);
    console.log(`   Expected: [${c.expected.join(', ')}]`);
    console.log(`   Got:      [${targets.join(', ')}]`);
    console.log('');
  }
}

// ----------------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------------

console.log('\n' + '═'.repeat(70));
console.log('   NEOCORTEX QUERY CLASSIFIER TEST SUITE');
console.log('═'.repeat(70));

// Run all test suites
runTests();
testTargetExtraction();
runDemo();

console.log('\n✅ All tests complete!\n');
