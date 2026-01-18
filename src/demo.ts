#!/usr/bin/env tsx
// ============================================================================
// FILE: src/demo.ts
// PURPOSE: Quick visual demo for presentations showing before/after compression
// ============================================================================

import 'dotenv/config';
import { cloneRepository, getSourceFiles } from './clone.js';
import { parseFile } from './parser.js';
import { buildDependencyGraph } from './graph.js';
import { buildSemanticIndex, semanticSearch } from './embeddings.js';
import { classifyQuery, getSearchStrategy, formatAnalysis } from './retrieval/classifier.js';
import { improvedSearch } from './retrieval/search.js';
import { selectWithinBudget } from './retrieval/budget.js';
import { CodeEntity } from './types.js';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function progressBar(current: number, total: number, width: number = 40): string {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return color('█'.repeat(filled), 'green') + color('░'.repeat(empty), 'dim');
}

async function runDemo(repoUrl: string, query: string, maxTokens: number = 2000) {
  console.clear();
  
  console.log('\n' + color('╔════════════════════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(color('║', 'cyan') + color('                   🧠 NEOCORTEX COMPRESSION DEMO                       ', 'bright') + color('║', 'cyan'));
  console.log(color('║', 'cyan') + color('                Semantic Compression for Code Context                  ', 'dim') + color('║', 'cyan'));
  console.log(color('╚════════════════════════════════════════════════════════════════════════╝', 'cyan'));
  
  console.log('\n' + color('📋 QUERY:', 'yellow') + ` "${query}"`);
  console.log(color('📦 REPO:', 'yellow') + ` ${repoUrl}`);
  console.log(color('🎯 BUDGET:', 'yellow') + ` ${formatNumber(maxTokens)} tokens\n`);

  // Step 1: Clone
  console.log(color('⏳ Step 1: Cloning repository...', 'dim'));
  const repoPath = await cloneRepository(repoUrl);
  console.log(color('✓ Cloned', 'green') + '\n');

  // Step 2: Get files
  console.log(color('⏳ Step 2: Scanning source files...', 'dim'));
  const files = await getSourceFiles(
    repoPath,
    ['.ts', '.tsx', '.js', '.jsx'],
    ['node_modules', 'dist', 'build', '.git', '*.test.ts', '*.spec.ts', '__tests__', '*.d.ts']
  );
  console.log(color('✓ Found', 'green') + ` ${files.length} files\n`);

  // Step 3: Parse
  console.log(color('⏳ Step 3: Parsing code with tree-sitter...', 'dim'));
  const entities: CodeEntity[] = [];
  for (const file of files) {
    try {
      entities.push(...await parseFile(file));
    } catch (e) {}
  }
  const totalTokens = entities.reduce((s, e) => s + e.tokens, 0);
  console.log(color('✓ Extracted', 'green') + ` ${entities.length} entities (${formatNumber(totalTokens)} total tokens)\n`);

  // Step 4: Build index
  console.log(color('⏳ Step 4: Building semantic index...', 'dim'));
  const semanticIndex = await buildSemanticIndex(
    entities,
    { model: 'openai', batchSize: 20, includeCode: false, includeDependencyContext: true, maxTokens: 512 }
  );
  console.log(color('✓ Index built', 'green') + ` (${entities.length} embeddings)\n`);

  // Step 5: Search
  console.log(color('⏳ Step 5: Running semantic search...', 'dim'));
  const analysis = classifyQuery(query);
  const strategy = getSearchStrategy(analysis);
  
  const rawResults = await semanticSearch(query, semanticIndex.store, semanticIndex.graph, {
    topK: strategy.topK
  });
  
  const scores = new Map<string, number>();
  for (const match of rawResults.matches) {
    scores.set(match.entity.entityId, match.score);
  }
  
  const improved = improvedSearch(query, entities, semanticIndex.graph, scores, {
    topK: strategy.topK,
    minScore: strategy.minScore,
    keywordBoost: strategy.keywordBoost,
    graphDepth: analysis.depth
  });
  
  console.log(color('✓ Found', 'green') + ` ${improved.length} relevant matches\n`);

  // Step 6: Budget selection
  console.log(color('⏳ Step 6: Applying token budget...', 'dim'));
  const ranked = improved.map(r => r.entity);
  const { selected, totalTokens: selectedTokens, context } = selectWithinBudget(ranked, maxTokens);
  console.log(color('✓ Selected', 'green') + ` ${selected.length} entities within budget\n`);

  // === RESULTS ===
  const reduction = ((totalTokens - selectedTokens) / totalTokens) * 100;
  const compressionRatio = totalTokens / selectedTokens;
  
  console.log(color('┌─────────────────────────────────────────────────────────────────────────┐', 'cyan'));
  console.log(color('│', 'cyan') + color('                         📊 COMPRESSION RESULTS                        ', 'bright') + color('│', 'cyan'));
  console.log(color('├─────────────────────────────────────────────────────────────────────────┤', 'cyan'));
  
  // Before
  console.log(color('│', 'cyan') + '                                                                         ' + color('│', 'cyan'));
  console.log(color('│', 'cyan') + color('  BEFORE (Full Codebase)', 'red') + '                                                ' + color('│', 'cyan'));
  console.log(color('│', 'cyan') + `  ${color(formatNumber(totalTokens).padStart(8), 'bright')} tokens                                                   ` + color('│', 'cyan'));
  console.log(color('│', 'cyan') + `  ${progressBar(totalTokens, totalTokens, 50)}  ` + color('│', 'cyan'));
  console.log(color('│', 'cyan') + '                                                                         ' + color('│', 'cyan'));
  
  // After
  console.log(color('│', 'cyan') + color('  AFTER (Neocortex Compression)', 'green') + '                                         ' + color('│', 'cyan'));
  console.log(color('│', 'cyan') + `  ${color(formatNumber(selectedTokens).padStart(8), 'bright')} tokens                                                   ` + color('│', 'cyan'));
  console.log(color('│', 'cyan') + `  ${progressBar(selectedTokens, totalTokens, 50)}  ` + color('│', 'cyan'));
  console.log(color('│', 'cyan') + '                                                                         ' + color('│', 'cyan'));
  
  console.log(color('├─────────────────────────────────────────────────────────────────────────┤', 'cyan'));
  
  // Key metrics
  console.log(color('│', 'cyan') + '                                                                         ' + color('│', 'cyan'));
  console.log(color('│', 'cyan') + `  ${color('TOKEN REDUCTION:', 'yellow')}     ${color(reduction.toFixed(1) + '%', 'green').padStart(15)}                                ` + color('│', 'cyan'));
  console.log(color('│', 'cyan') + `  ${color('COMPRESSION RATIO:', 'yellow')}   ${color(compressionRatio.toFixed(1) + 'x', 'green').padStart(15)}                                ` + color('│', 'cyan'));
  console.log(color('│', 'cyan') + `  ${color('ENTITIES SELECTED:', 'yellow')}   ${color(selected.length + '/' + entities.length, 'green').padStart(15)}                                ` + color('│', 'cyan'));
  console.log(color('│', 'cyan') + '                                                                         ' + color('│', 'cyan'));
  
  console.log(color('└─────────────────────────────────────────────────────────────────────────┘', 'cyan'));
  
  // Query analysis
  console.log('\n' + color('🎯 QUERY ANALYSIS', 'yellow'));
  console.log(color('─'.repeat(40), 'dim'));
  console.log(`  Type: ${color(analysis.type, 'cyan')}`);
  console.log(`  Confidence: ${color(Math.round(analysis.confidence * 100) + '%', 'green')}`);
  console.log(`  Graph depth: ${analysis.depth}`);
  console.log(`  Targets: ${analysis.targets.join(', ') || '(general)'}`);
  
  // Selected entities
  console.log('\n' + color('📝 SELECTED ENTITIES', 'yellow'));
  console.log(color('─'.repeat(40), 'dim'));
  selected.slice(0, 8).forEach((e, i) => {
    const matchType = improved.find(r => r.entity.id === e.id)?.matchType || 'semantic';
    const typeIcon = e.type === 'function' ? 'ƒ' : e.type === 'class' ? '◇' : '◆';
    const typeColor = matchType === 'keyword' ? 'yellow' : matchType === 'graph' ? 'magenta' : 'cyan';
    console.log(`  ${i + 1}. ${color(typeIcon, 'dim')} ${color(e.name, 'bright')} ${color(`[${matchType}]`, typeColor)} - ${e.tokens} tokens`);
  });
  if (selected.length > 8) {
    console.log(color(`  ... and ${selected.length - 8} more`, 'dim'));
  }
  
  // Cost savings
  const costBefore = (totalTokens / 1000) * 0.01; // GPT-4o pricing
  const costAfter = (selectedTokens / 1000) * 0.01;
  const saved = costBefore - costAfter;
  
  console.log('\n' + color('💰 COST IMPACT (GPT-4o)', 'yellow'));
  console.log(color('─'.repeat(40), 'dim'));
  console.log(`  Before: $${costBefore.toFixed(4)}/query`);
  console.log(`  After:  $${costAfter.toFixed(4)}/query`);
  console.log(`  Saved:  ${color('$' + saved.toFixed(4), 'green')}/query (${color(reduction.toFixed(1) + '%', 'green')})`);
  console.log(`  At 10k queries/month: ${color('$' + (saved * 10000).toFixed(2), 'green')} saved`);
  
  console.log('\n' + color('═'.repeat(73), 'dim'));
  console.log(color('  ✅ Demo complete! Context is ready for any LLM.', 'green'));
  console.log(color('═'.repeat(73), 'dim') + '\n');
}

// Parse command line
const args = process.argv.slice(2);
const repoUrl = args[0] || 'https://github.com/rusheelsharma/progressiveoverload.git';
const query = args[1] || 'how does authentication work';
const maxTokens = parseInt(args[2]) || 2000;

runDemo(repoUrl, query, maxTokens).catch(console.error);
