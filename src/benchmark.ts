#!/usr/bin/env tsx
// ============================================================================
// FILE: src/benchmark.ts
// PURPOSE: Comprehensive benchmarking suite for Neocortex compression metrics
// ============================================================================

import 'dotenv/config';
import { cloneRepository, getSourceFiles } from './clone.js';
import { parseFile } from './parser.js';
import { buildDependencyGraph } from './graph.js';
import { buildSemanticIndex, semanticSearch } from './embeddings.js';
import { classifyQuery, getSearchStrategy } from './retrieval/classifier.js';
import { improvedSearch } from './retrieval/search.js';
import { selectWithinBudget } from './retrieval/budget.js';
import { CodeEntity } from './types.js';
import * as fs from 'fs/promises';

// ============================================================================
// BENCHMARK CONFIGURATION
// ============================================================================

interface BenchmarkQuery {
  query: string;
  category: 'simple' | 'architectural' | 'debugging' | 'multi-hop';
}

interface RepoConfig {
  url: string;
  name: string;
  queries: BenchmarkQuery[];
}

// Test repositories and queries
const BENCHMARK_REPOS: RepoConfig[] = [
  {
    url: 'https://github.com/sindresorhus/is.git',
    name: 'sindresorhus/is',
    queries: [
      { query: 'what types are exported', category: 'simple' },
      { query: 'how does type checking work', category: 'architectural' },
      { query: 'what is the isString function', category: 'simple' },
    ]
  },
  {
    url: 'https://github.com/rusheelsharma/progressiveoverload.git',
    name: 'progressiveoverload',
    queries: [
      { query: 'how does authentication work', category: 'architectural' },
      { query: 'what variables store user data', category: 'simple' },
      { query: 'how are exercises tracked', category: 'multi-hop' },
      { query: 'what happens when login fails', category: 'debugging' },
    ]
  },
  {
    url: 'https://github.com/rusheelsharma/personal-portfolio.git',
    name: 'personal-portfolio',
    queries: [
      { query: 'what components are there', category: 'simple' },
      { query: 'how is navigation implemented', category: 'architectural' },
      { query: 'what is the Projects component', category: 'simple' },
    ]
  },
  {
    url: 'https://github.com/Aditya292248/Memora.git',
    name: 'Memora',
    queries: [
      { query: 'how does the family tree work', category: 'architectural' },
      { query: 'what happens when adding a memory', category: 'multi-hop' },
      { query: 'how is data stored', category: 'architectural' },
      { query: 'what components render the UI', category: 'simple' },
    ]
  }
];

const TOKEN_BUDGETS = [500, 1000, 2000, 4000];
const COST_PER_1K_INPUT_TOKENS = 0.00015; // GPT-4o-mini pricing
const COST_PER_1K_INPUT_TOKENS_GPT4 = 0.01; // GPT-4o pricing

// ============================================================================
// BENCHMARK TYPES
// ============================================================================

interface QueryResult {
  query: string;
  category: string;
  totalEntities: number;
  totalTokens: number;
  selectedEntities: number;
  selectedTokens: number;
  compressionRatio: number;
  tokenReduction: number;
  searchTimeMs: number;
  topScore: number;
  queryType: string;
  confidence: number;
}

interface RepoBenchmark {
  repo: string;
  totalFiles: number;
  totalEntities: number;
  totalCodeTokens: number;
  parseTimeMs: number;
  embedTimeMs: number;
  queries: QueryResult[];
  avgCompressionRatio: number;
  avgTokenReduction: number;
  avgSearchTimeMs: number;
}

interface BenchmarkSummary {
  timestamp: string;
  repos: RepoBenchmark[];
  overall: {
    totalRepos: number;
    totalQueries: number;
    avgCompressionRatio: number;
    avgTokenReduction: number;
    avgSearchTimeMs: number;
    estimatedCostSavings: {
      gpt4oMini: { before: number; after: number; saved: number; percent: number };
      gpt4o: { before: number; after: number; saved: number; percent: number };
    };
  };
  byBudget: {
    budget: number;
    avgCompression: number;
    avgReduction: number;
  }[];
  byCategory: {
    category: string;
    avgCompression: number;
    avgReduction: number;
    count: number;
  }[];
}

// ============================================================================
// BENCHMARK RUNNER
// ============================================================================

async function benchmarkRepo(config: RepoConfig): Promise<RepoBenchmark> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 Benchmarking: ${config.name}`);
  console.log(`${'═'.repeat(60)}`);

  // Clone
  console.log('\n📥 Cloning repository...');
  const repoPath = await cloneRepository(config.url);

  // Get files
  const files = await getSourceFiles(
    repoPath,
    ['.ts', '.tsx', '.js', '.jsx'],
    ['node_modules', 'dist', 'build', '.git', '*.test.ts', '*.spec.ts', '__tests__', '*.d.ts']
  );
  console.log(`   Found ${files.length} source files`);

  // Parse
  console.log('\n🔍 Parsing files...');
  const parseStart = Date.now();
  const entities: CodeEntity[] = [];
  for (const file of files) {
    try {
      const parsed = await parseFile(file);
      entities.push(...parsed);
    } catch (e) {
      // Skip unparseable
    }
  }
  const parseTimeMs = Date.now() - parseStart;
  console.log(`   Extracted ${entities.length} entities in ${parseTimeMs}ms`);

  // Calculate total code tokens
  const totalCodeTokens = entities.reduce((sum, e) => sum + e.tokens, 0);
  console.log(`   Total code tokens: ${totalCodeTokens.toLocaleString()}`);

  // Build embeddings
  console.log('\n🧬 Building embeddings...');
  const embedStart = Date.now();
  const semanticIndex = await buildSemanticIndex(
    entities,
    { model: 'openai', batchSize: 20, includeCode: false, includeDependencyContext: true, maxTokens: 512 }
  );
  const embedTimeMs = Date.now() - embedStart;
  console.log(`   Built embeddings in ${embedTimeMs}ms`);

  // Run queries
  console.log('\n🔎 Running benchmark queries...');
  const queryResults: QueryResult[] = [];

  for (const budget of TOKEN_BUDGETS) {
    for (const q of config.queries) {
      const searchStart = Date.now();

      // Classify
      const analysis = classifyQuery(q.query);
      const strategy = getSearchStrategy(analysis);

      // Search
      const rawResults = await semanticSearch(
        q.query,
        semanticIndex.store,
        semanticIndex.graph,
        { topK: strategy.topK }
      );

      const topScore = rawResults.matches[0]?.score ?? 0;

      // Build scores
      const scores = new Map<string, number>();
      for (const match of rawResults.matches) {
        scores.set(match.entity.entityId, match.score);
      }

      // Improved search
      const improved = improvedSearch(q.query, entities, semanticIndex.graph, scores, {
        topK: strategy.topK,
        minScore: strategy.minScore,
        keywordBoost: strategy.keywordBoost,
        graphDepth: analysis.depth
      });

      // Budget selection
      const ranked = improved.map(r => r.entity);
      const { selected, totalTokens } = selectWithinBudget(ranked, budget);

      const searchTimeMs = Date.now() - searchStart;

      const compressionRatio = totalCodeTokens > 0 ? totalTokens / totalCodeTokens : 0;
      const tokenReduction = totalCodeTokens > 0 ? ((totalCodeTokens - totalTokens) / totalCodeTokens) * 100 : 0;

      queryResults.push({
        query: q.query,
        category: q.category,
        totalEntities: entities.length,
        totalTokens: totalCodeTokens,
        selectedEntities: selected.length,
        selectedTokens: totalTokens,
        compressionRatio,
        tokenReduction,
        searchTimeMs,
        topScore,
        queryType: analysis.type,
        confidence: analysis.confidence
      });

      console.log(`   [${budget} tokens] "${q.query.slice(0, 30)}..." → ${selected.length} entities, ${totalTokens} tokens (${tokenReduction.toFixed(1)}% reduction)`);
    }
  }

  // Calculate averages
  const avgCompressionRatio = queryResults.reduce((s, r) => s + r.compressionRatio, 0) / queryResults.length;
  const avgTokenReduction = queryResults.reduce((s, r) => s + r.tokenReduction, 0) / queryResults.length;
  const avgSearchTimeMs = queryResults.reduce((s, r) => s + r.searchTimeMs, 0) / queryResults.length;

  return {
    repo: config.name,
    totalFiles: files.length,
    totalEntities: entities.length,
    totalCodeTokens,
    parseTimeMs,
    embedTimeMs,
    queries: queryResults,
    avgCompressionRatio,
    avgTokenReduction,
    avgSearchTimeMs
  };
}

async function runBenchmarks(): Promise<BenchmarkSummary> {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           🧠 NEOCORTEX BENCHMARK SUITE                     ║');
  console.log('║           Semantic Compression for Code Context            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const repoBenchmarks: RepoBenchmark[] = [];

  for (const repo of BENCHMARK_REPOS) {
    try {
      const result = await benchmarkRepo(repo);
      repoBenchmarks.push(result);
    } catch (e) {
      console.error(`Failed to benchmark ${repo.name}:`, e);
    }
  }

  // Calculate overall stats
  const allQueries = repoBenchmarks.flatMap(r => r.queries);
  const totalQueries = allQueries.length;

  const avgCompressionRatio = allQueries.reduce((s, r) => s + r.compressionRatio, 0) / totalQueries;
  const avgTokenReduction = allQueries.reduce((s, r) => s + r.tokenReduction, 0) / totalQueries;
  const avgSearchTimeMs = allQueries.reduce((s, r) => s + r.searchTimeMs, 0) / totalQueries;

  // Cost calculations (using 2000 token budget as reference)
  const budget2000Queries = allQueries.filter((_, i) => Math.floor(i / BENCHMARK_REPOS[0].queries.length) % TOKEN_BUDGETS.length === 2);
  const avgTotalTokens = repoBenchmarks.reduce((s, r) => s + r.totalCodeTokens, 0) / repoBenchmarks.length;
  const avgSelectedTokens = budget2000Queries.reduce((s, r) => s + r.selectedTokens, 0) / budget2000Queries.length;

  const costBefore4oMini = (avgTotalTokens / 1000) * COST_PER_1K_INPUT_TOKENS;
  const costAfter4oMini = (avgSelectedTokens / 1000) * COST_PER_1K_INPUT_TOKENS;
  const costBefore4o = (avgTotalTokens / 1000) * COST_PER_1K_INPUT_TOKENS_GPT4;
  const costAfter4o = (avgSelectedTokens / 1000) * COST_PER_1K_INPUT_TOKENS_GPT4;

  // Stats by budget
  const byBudget = TOKEN_BUDGETS.map(budget => {
    const budgetQueries = allQueries.filter((_, i) => 
      Math.floor(i / (BENCHMARK_REPOS.reduce((s, r) => s + r.queries.length, 0) / BENCHMARK_REPOS.length)) % TOKEN_BUDGETS.length === TOKEN_BUDGETS.indexOf(budget)
    );
    return {
      budget,
      avgCompression: budgetQueries.reduce((s, r) => s + r.compressionRatio, 0) / budgetQueries.length,
      avgReduction: budgetQueries.reduce((s, r) => s + r.tokenReduction, 0) / budgetQueries.length
    };
  });

  // Stats by category
  const categories = ['simple', 'architectural', 'debugging', 'multi-hop'];
  const byCategory = categories.map(cat => {
    const catQueries = allQueries.filter(q => q.category === cat);
    return {
      category: cat,
      avgCompression: catQueries.length > 0 ? catQueries.reduce((s, r) => s + r.compressionRatio, 0) / catQueries.length : 0,
      avgReduction: catQueries.length > 0 ? catQueries.reduce((s, r) => s + r.tokenReduction, 0) / catQueries.length : 0,
      count: catQueries.length
    };
  }).filter(c => c.count > 0);

  return {
    timestamp: new Date().toISOString(),
    repos: repoBenchmarks,
    overall: {
      totalRepos: repoBenchmarks.length,
      totalQueries,
      avgCompressionRatio,
      avgTokenReduction,
      avgSearchTimeMs,
      estimatedCostSavings: {
        gpt4oMini: {
          before: costBefore4oMini,
          after: costAfter4oMini,
          saved: costBefore4oMini - costAfter4oMini,
          percent: ((costBefore4oMini - costAfter4oMini) / costBefore4oMini) * 100
        },
        gpt4o: {
          before: costBefore4o,
          after: costAfter4o,
          saved: costBefore4o - costAfter4o,
          percent: ((costBefore4o - costAfter4o) / costBefore4o) * 100
        }
      }
    },
    byBudget,
    byCategory
  };
}

function formatResults(summary: BenchmarkSummary): string {
  const lines: string[] = [];
  
  lines.push('\n');
  lines.push('╔════════════════════════════════════════════════════════════════════════════╗');
  lines.push('║                    🧠 NEOCORTEX BENCHMARK RESULTS                          ║');
  lines.push('╚════════════════════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Overall Stats
  lines.push('┌────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 📊 OVERALL PERFORMANCE                                                     │');
  lines.push('├────────────────────────────────────────────────────────────────────────────┤');
  lines.push(`│  Repositories tested:     ${summary.overall.totalRepos.toString().padStart(6)}                                        │`);
  lines.push(`│  Queries executed:        ${summary.overall.totalQueries.toString().padStart(6)}                                        │`);
  lines.push(`│  Avg token reduction:     ${summary.overall.avgTokenReduction.toFixed(1).padStart(6)}%                                       │`);
  lines.push(`│  Avg search latency:      ${summary.overall.avgSearchTimeMs.toFixed(0).padStart(6)}ms                                       │`);
  lines.push('└────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');

  // Compression by Budget
  lines.push('┌────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 📉 COMPRESSION BY TOKEN BUDGET                                             │');
  lines.push('├──────────────┬───────────────────┬─────────────────────────────────────────┤');
  lines.push('│ Budget       │ Token Reduction   │ Visual                                  │');
  lines.push('├──────────────┼───────────────────┼─────────────────────────────────────────┤');
  
  for (const b of summary.byBudget) {
    const bar = '█'.repeat(Math.round(b.avgReduction / 5)) + '░'.repeat(20 - Math.round(b.avgReduction / 5));
    lines.push(`│ ${b.budget.toString().padStart(6)} tokens │ ${b.avgReduction.toFixed(1).padStart(15)}% │ ${bar} │`);
  }
  lines.push('└──────────────┴───────────────────┴─────────────────────────────────────────┘');
  lines.push('');

  // Performance by Query Type
  lines.push('┌────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 🎯 PERFORMANCE BY QUERY TYPE                                               │');
  lines.push('├──────────────────┬───────────────────┬───────────────────────────────────┤');
  lines.push('│ Query Type       │ Token Reduction   │ Queries                           │');
  lines.push('├──────────────────┼───────────────────┼───────────────────────────────────┤');
  
  for (const c of summary.byCategory) {
    lines.push(`│ ${c.category.padEnd(16)} │ ${c.avgReduction.toFixed(1).padStart(15)}% │ ${c.count.toString().padStart(15)} tested          │`);
  }
  lines.push('└──────────────────┴───────────────────┴───────────────────────────────────┘');
  lines.push('');

  // Cost Savings
  lines.push('┌────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 💰 ESTIMATED COST SAVINGS (per query, avg codebase)                        │');
  lines.push('├────────────────────────────────────────────────────────────────────────────┤');
  const s4oMini = summary.overall.estimatedCostSavings.gpt4oMini;
  const s4o = summary.overall.estimatedCostSavings.gpt4o;
  lines.push(`│  GPT-4o-mini:  $${s4oBefore(s4oMini.before)} → $${s4oAfter(s4oMini.after)}  (${s4oMini.percent.toFixed(1)}% saved)                     │`);
  lines.push(`│  GPT-4o:       $${s4oBefore(s4o.before)} → $${s4oAfter(s4o.after)}  (${s4o.percent.toFixed(1)}% saved)                     │`);
  lines.push('├────────────────────────────────────────────────────────────────────────────┤');
  lines.push('│  At 10,000 queries/month:                                                  │');
  lines.push(`│    GPT-4o-mini: Save $${(s4oMini.saved * 10000).toFixed(2).padStart(8)}/month                                    │`);
  lines.push(`│    GPT-4o:      Save $${(s4o.saved * 10000).toFixed(2).padStart(8)}/month                                    │`);
  lines.push('└────────────────────────────────────────────────────────────────────────────┘');
  lines.push('');

  // Per-Repo Details
  lines.push('┌────────────────────────────────────────────────────────────────────────────┐');
  lines.push('│ 📁 PER-REPOSITORY DETAILS                                                  │');
  lines.push('└────────────────────────────────────────────────────────────────────────────┘');
  
  for (const repo of summary.repos) {
    lines.push('');
    lines.push(`  📂 ${repo.repo}`);
    lines.push(`     Files: ${repo.totalFiles} | Entities: ${repo.totalEntities} | Total tokens: ${repo.totalCodeTokens.toLocaleString()}`);
    lines.push(`     Parse: ${repo.parseTimeMs}ms | Embed: ${repo.embedTimeMs}ms`);
    lines.push(`     Avg reduction: ${repo.avgTokenReduction.toFixed(1)}% | Avg latency: ${repo.avgSearchTimeMs.toFixed(0)}ms`);
  }
  
  lines.push('');
  lines.push('═'.repeat(78));
  lines.push(`Benchmark completed: ${summary.timestamp}`);
  lines.push('═'.repeat(78));

  return lines.join('\n');
}

function s4oBefore(n: number): string {
  return n.toFixed(4).padStart(7);
}

function s4oAfter(n: number): string {
  return n.toFixed(4).padStart(7);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    const summary = await runBenchmarks();
    
    // Print formatted results
    const formatted = formatResults(summary);
    console.log(formatted);

    // Save JSON results
    await fs.writeFile(
      './output/benchmark-results.json',
      JSON.stringify(summary, null, 2)
    );
    console.log('\n📄 Detailed results saved to: ./output/benchmark-results.json');

    // Save markdown report
    const markdown = generateMarkdownReport(summary);
    await fs.writeFile('./BENCHMARKS.md', markdown);
    console.log('📄 Markdown report saved to: ./BENCHMARKS.md');

  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

function generateMarkdownReport(summary: BenchmarkSummary): string {
  return `# 🧠 Neocortex Benchmark Results

> **Semantic Compression for Code Context**  
> Benchmark run: ${new Date(summary.timestamp).toLocaleString()}

---

## 📊 Key Metrics

| Metric | Value |
|--------|-------|
| **Average Token Reduction** | **${summary.overall.avgTokenReduction.toFixed(1)}%** |
| **Average Search Latency** | ${summary.overall.avgSearchTimeMs.toFixed(0)}ms |
| **Repositories Tested** | ${summary.overall.totalRepos} |
| **Queries Executed** | ${summary.overall.totalQueries} |

---

## 📉 Compression by Token Budget

| Budget | Token Reduction | Compression Ratio |
|--------|-----------------|-------------------|
${summary.byBudget.map(b => `| ${b.budget} tokens | **${b.avgReduction.toFixed(1)}%** | ${(1 - b.avgCompression).toFixed(3)}x |`).join('\n')}

---

## 🎯 Performance by Query Type

| Query Type | Token Reduction | Queries Tested |
|------------|-----------------|----------------|
${summary.byCategory.map(c => `| ${c.category} | **${c.avgReduction.toFixed(1)}%** | ${c.count} |`).join('\n')}

---

## 💰 Cost Savings Analysis

Based on average codebase size and 2000 token budget:

### Per Query
| Model | Before | After | Savings |
|-------|--------|-------|---------|
| GPT-4o-mini | $${summary.overall.estimatedCostSavings.gpt4oMini.before.toFixed(5)} | $${summary.overall.estimatedCostSavings.gpt4oMini.after.toFixed(5)} | **${summary.overall.estimatedCostSavings.gpt4oMini.percent.toFixed(1)}%** |
| GPT-4o | $${summary.overall.estimatedCostSavings.gpt4o.before.toFixed(5)} | $${summary.overall.estimatedCostSavings.gpt4o.after.toFixed(5)} | **${summary.overall.estimatedCostSavings.gpt4o.percent.toFixed(1)}%** |

### At Scale (10,000 queries/month)
| Model | Monthly Savings |
|-------|-----------------|
| GPT-4o-mini | **$${(summary.overall.estimatedCostSavings.gpt4oMini.saved * 10000).toFixed(2)}** |
| GPT-4o | **$${(summary.overall.estimatedCostSavings.gpt4o.saved * 10000).toFixed(2)}** |

---

## 📁 Repository Details

${summary.repos.map(repo => `
### ${repo.repo}

| Metric | Value |
|--------|-------|
| Files | ${repo.totalFiles} |
| Entities | ${repo.totalEntities} |
| Total Tokens | ${repo.totalCodeTokens.toLocaleString()} |
| Parse Time | ${repo.parseTimeMs}ms |
| Embed Time | ${repo.embedTimeMs}ms |
| Avg Reduction | **${repo.avgTokenReduction.toFixed(1)}%** |
| Avg Latency | ${repo.avgSearchTimeMs.toFixed(0)}ms |
`).join('\n')}

---

## 🔬 Methodology

1. **Clone** - Repository cloned to local temp directory
2. **Parse** - AST extraction using tree-sitter for all .ts/.tsx/.js/.jsx files
3. **Index** - Build dependency graph and generate OpenAI embeddings
4. **Query** - Run benchmark queries at multiple token budgets
5. **Measure** - Record token counts, compression ratios, and latencies

### Test Queries
${summary.repos.map(repo => `
**${repo.repo}:**
${repo.queries.map(q => `- "${q.query}" (${q.category})`).join('\n')}
`).join('\n')}

---

## 🏆 Summary

Neocortex achieves **${summary.overall.avgTokenReduction.toFixed(0)}% average token reduction** through semantic compression:

- **Content-aware selection**: Only relevant code entities are included
- **Dependency expansion**: Related functions discovered via call graph
- **Smart slicing**: Long functions compressed while preserving key sections
- **Query optimization**: Search strategy adapted to query type

This enables fitting **${(100 / (100 - summary.overall.avgTokenReduction)).toFixed(1)}x more context** into the same LLM token window, or achieving **${summary.overall.avgTokenReduction.toFixed(0)}% cost savings** per query.

---

*Generated by Neocortex Benchmark Suite*
`;
}

main();
