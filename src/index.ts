#!/usr/bin/env node
// ============================================================================
// FILE: src/index.ts
// PURPOSE: CLI entry point for Neocortex
// ============================================================================

import 'dotenv/config';
import { Command } from 'commander';
import { cloneRepository, getSourceFiles } from './clone.js';
import { parseFile } from './parser.js';
import { generateAllExamples, prepareDataset } from './generator.js';
import { writeJSONL, writeDatasetSplits, writeStats, formatStats, calculateStats } from './output.js';
import { CodeEntity, GeneratorConfig, DEFAULT_CONFIG } from './types.js';
import { buildDependencyGraph, getGraphStats, expandDependencies } from './graph.js';
import {
  buildSemanticIndex,
  semanticSearch,
  searchByName,
  formatSearchResults,
  saveSemanticIndex,
  getEmbeddingStats,
  DEFAULT_EMBEDDING_CONFIG,
  EmbeddingConfig,
} from './embeddings.js';

const program = new Command();

program
  .name('neocortex')
  .description('Generate SLM training data from GitHub repos')
  .version('1.0.0');

// ============================================================================
// GENERATE COMMAND
// ============================================================================

program
  .command('generate')
  .description('Generate training data from a repository')
  .argument('<repo-url>', 'GitHub repository URL')
  .option('-o, --output <path>', 'Output path', './output/training.jsonl')
  .option('-q, --questions <n>', 'Questions per entity', '5')
  .option('--split', 'Split into train/val/test')
  .option('--no-metadata', 'Exclude metadata')
  .option('--min-lines <n>', 'Min function lines', '3')
  .option('--max-lines <n>', 'Max function lines', '200')
  .action(async (repoUrl: string, opts) => {
    console.log('\n🧠 Neocortex Training Data Generator\n');
    const startTime = Date.now();

    const config: GeneratorConfig = {
      ...DEFAULT_CONFIG,
      repoUrl,
      outputPath: opts.output,
      questionsPerEntity: parseInt(opts.questions),
      includeMetadata: opts.metadata !== false,
      minFunctionLines: parseInt(opts.minLines),
      maxFunctionLines: parseInt(opts.maxLines),
      generateResponses: true,
      splitRatio: opts.split ? { train: 0.8, val: 0.1, test: 0.1 } : undefined
    } as GeneratorConfig;

    try {
      // 1. Clone repository
      const repoPath = await cloneRepository(repoUrl);

      // 2. Find source files
      console.log('\n📝 Scanning files...');
      const files = await getSourceFiles(
        repoPath,
        ['.ts', '.tsx', '.js', '.jsx'],
        config.excludePatterns || []
      );
      console.log(`   Found ${files.length} source files`);

      // 3. Parse files
      console.log('\n🔍 Parsing...');
      const entities: CodeEntity[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          entities.push(...await parseFile(files[i]));
          if ((i + 1) % 50 === 0 || i === files.length - 1) {
            process.stdout.write(`\r   Parsed ${i + 1}/${files.length} files (${entities.length} entities)`);
          }
        } catch {
          // Skip files that fail to parse
        }
      }
      console.log('\n');

      // 4. Generate examples
      console.log('🧠 Generating examples...');
      const examples = generateAllExamples(entities, config, (cur, total) => {
        const pct = Math.round((cur / total) * 100);
        process.stdout.write(`\r   [${'█'.repeat(Math.floor(pct / 5))}${'░'.repeat(20 - Math.floor(pct / 5))}] ${pct}%`);
      });
      console.log('\n');

      // 5. Write output
      console.log('💾 Writing...');
      if (opts.split) {
        const dataset = prepareDataset(examples, config);
        const written = await writeDatasetSplits(dataset, config.outputPath);
        console.log(`   ${written.join(', ')}`);
      } else {
        await writeJSONL(examples, config.outputPath);
        console.log(`   ${config.outputPath}`);
      }

      // 6. Calculate and write stats
      const repoName = repoUrl.split('/').slice(-2).join('/');
      const stats = calculateStats(repoName, files.length, entities, examples, startTime);
      await writeStats(stats, config.outputPath);
      console.log(formatStats(stats));
      console.log('✅ Done!\n');

    } catch (err) {
      console.error('\n❌ Error:', err);
      process.exit(1);
    }
  });

// ============================================================================
// PREVIEW COMMAND
// ============================================================================

program
  .command('preview')
  .description('Preview examples without writing')
  .argument('<repo-url>', 'GitHub repository URL')
  .option('-n, --num <n>', 'Examples to show', '5')
  .action(async (repoUrl: string, opts) => {
    const config = {
      ...DEFAULT_CONFIG,
      repoUrl,
      outputPath: '',
      questionsPerEntity: 3,
      includeMetadata: true,
      generateResponses: true
    } as GeneratorConfig;

    try {
      const repoPath = await cloneRepository(repoUrl);
      const files = await getSourceFiles(repoPath, ['.ts', '.tsx', '.js', '.jsx'], config.excludePatterns || []);
      
      const entities: CodeEntity[] = [];
      for (const f of files.slice(0, 10)) {
        try {
          entities.push(...await parseFile(f));
        } catch {
          // Skip files that fail to parse
        }
      }
      
      const examples = generateAllExamples(entities, config).slice(0, parseInt(opts.num));
      
      console.log(`\n📄 Preview (${examples.length}):\n`);
      examples.forEach(ex => {
        console.log('─'.repeat(50));
        console.log(`Q: ${ex.instruction}`);
        console.log(`A: ${ex.response.slice(0, 200)}${ex.response.length > 200 ? '...' : ''}`);
      });
      console.log('');
    } catch (err) {
      console.error('\n❌ Error:', err);
      process.exit(1);
    }
  });

// ============================================================================
// STATS COMMAND
// ============================================================================

program
  .command('stats')
  .description('Show stats for a dataset')
  .argument('<file>', 'JSONL file to analyze')
  .action(async (file: string) => {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(file, 'utf-8');
      const examples = content.trim().split('\n').map(l => JSON.parse(l));
      
      const byType: Record<string, number> = {};
      const byDiff: Record<string, number> = {};
      
      examples.forEach((ex: any) => {
        const qType = ex.metadata?.question_type || 'unknown';
        const diff = ex.metadata?.difficulty || 'unknown';
        byType[qType] = (byType[qType] || 0) + 1;
        byDiff[diff] = (byDiff[diff] || 0) + 1;
      });
      
      console.log(`\n📊 Dataset Statistics`);
      console.log(`Total examples: ${examples.length}`);
      console.log('\nBy question type:', byType);
      console.log('By difficulty:', byDiff);
      console.log('');
    } catch (err) {
      console.error('\n❌ Error:', err);
      process.exit(1);
    }
  });

// ============================================================================
// GRAPH COMMAND
// ============================================================================

program
  .command('graph')
  .description('Build and display dependency graph for a repository')
  .argument('<repo-url>', 'GitHub repository URL')
  .option('--expand <name>', 'Expand dependencies for a specific function')
  .action(async (repoUrl: string, opts) => {
    console.log('\n🕸️  Building Dependency Graph\n');

    try {
      // Clone and parse
      const repoPath = await cloneRepository(repoUrl);
      const files = await getSourceFiles(
        repoPath,
        ['.ts', '.tsx', '.js', '.jsx'],
        DEFAULT_CONFIG.excludePatterns || []
      );

      console.log(`📝 Parsing ${files.length} files...`);
      const entities: CodeEntity[] = [];
      for (const file of files) {
        try {
          entities.push(...await parseFile(file));
        } catch { /* skip */ }
      }
      console.log(`   Found ${entities.length} entities\n`);

      // Build graph
      console.log('🔗 Building dependency graph...');
      const graph = buildDependencyGraph(entities);
      const stats = getGraphStats(graph);

      console.log(`
📊 Graph Statistics
═══════════════════════════════
Entities:          ${stats.totalEntities}
Edges:             ${stats.totalEdges}
Avg dependencies:  ${stats.avgDependencies.toFixed(2)}
Avg dependents:    ${stats.avgDependents.toFixed(2)}

🔥 Most Called Functions:
${stats.mostCalled.map(m => `   ${m.name}: ${m.count} callers`).join('\n') || '   (none)'}

📦 Functions with Most Dependencies:
${stats.mostDependencies.map(m => `   ${m.name}: ${m.count} calls`).join('\n') || '   (none)'}
`);

      // Expand specific function if requested
      if (opts.expand) {
        console.log(`\n🔍 Expanding: ${opts.expand}`);
        const ids = graph.nameToIds.get(opts.expand) || [];
        if (ids.length === 0) {
          console.log('   Function not found');
        } else {
          const expanded = expandDependencies(graph, ids, 2);
          console.log(`
   Primary matches:  ${expanded.primary.map(e => e.name).join(', ') || '(none)'}
   Dependencies:     ${expanded.dependencies.map(e => e.name).join(', ') || '(none)'}
   Dependents:       ${expanded.dependents.map(e => e.name).join(', ') || '(none)'}
   Related types:    ${expanded.types.map(e => e.name).join(', ') || '(none)'}
`);
        }
      }

      console.log('✅ Done!\n');
    } catch (err) {
      console.error('\n❌ Error:', err);
      process.exit(1);
    }
  });

// ============================================================================
// EMBED COMMAND
// ============================================================================

program
  .command('embed')
  .description('Build semantic embeddings index for a repository')
  .argument('<repo-url>', 'GitHub repository URL')
  .option('-o, --output <path>', 'Output path for index', './output/index')
  .option('--model <model>', 'Embedding model (openai|voyage-code-2)', 'openai')
  .option('--include-code', 'Include code in embeddings (increases accuracy but uses more tokens)')
  .action(async (repoUrl: string, opts) => {
    console.log('\n🧬 Building Semantic Index\n');

    try {
      // 1. Clone & parse
      const repoPath = await cloneRepository(repoUrl);
      const files = await getSourceFiles(
        repoPath,
        ['.ts', '.tsx', '.js', '.jsx'],
        DEFAULT_CONFIG.excludePatterns || []
      );

      console.log(`📝 Parsing ${files.length} files...`);
      const entities: CodeEntity[] = [];
      for (const file of files) {
        try {
          entities.push(...await parseFile(file));
        } catch { /* skip */ }
      }
      console.log(`   Found ${entities.length} entities\n`);

      // 2. Build semantic index
      const config: EmbeddingConfig = {
        ...DEFAULT_EMBEDDING_CONFIG,
        model: opts.model as 'openai' | 'voyage-code-2',
        includeCode: opts.includeCode || false,
      };

      console.log(`🧬 Generating embeddings with ${config.model}...`);
      const index = await buildSemanticIndex(entities, config, (stage, cur, total) => {
        if (stage === 'Generating embeddings') {
          const pct = Math.round((cur / total) * 100);
          process.stdout.write(`\r   [${'█'.repeat(Math.floor(pct / 5))}${'░'.repeat(20 - Math.floor(pct / 5))}] ${pct}% (${cur}/${total})`);
        }
      });
      console.log('\n');

      // 3. Save
      console.log('💾 Saving index...');
      await saveSemanticIndex(index, opts.output);
      console.log(`   Saved to ${opts.output}.vectors.json`);

      // 4. Stats
      const embeddingStats = getEmbeddingStats(index.store);
      const graphStats = getGraphStats(index.graph);

      console.log(`
📊 Index Statistics
═══════════════════════════════
Entities indexed:  ${embeddingStats.totalVectors}
Graph edges:       ${graphStats.totalEdges}
Vector dimension:  ${embeddingStats.avgVectorDimension}

By type:
${Object.entries(embeddingStats.byType).map(([t, c]) => `   ${t}: ${c}`).join('\n')}
`);
      console.log('✅ Done!\n');
    } catch (err) {
      console.error('\n❌ Error:', err);
      process.exit(1);
    }
  });

// ============================================================================
// SEARCH COMMAND
// ============================================================================

program
  .command('search')
  .description('Semantic search across a repository')
  .argument('<repo-url>', 'GitHub repository URL')
  .argument('<query>', 'Search query (natural language or function name)')
  .option('-k, --top-k <n>', 'Number of results', '5')
  .option('--depth <n>', 'Dependency expansion depth', '2')
  .option('--by-name', 'Search by exact function name instead of semantic')
  .option('--code', 'Include code in output')
  .option('--model <model>', 'Embedding model (openai|voyage-code-2)', 'openai')
  .action(async (repoUrl: string, query: string, opts) => {
    console.log('\n🔍 Semantic Search\n');

    try {
      // 1. Clone & parse
      const repoPath = await cloneRepository(repoUrl);
      const files = await getSourceFiles(
        repoPath,
        ['.ts', '.tsx', '.js', '.jsx'],
        DEFAULT_CONFIG.excludePatterns || []
      );

      console.log(`📝 Parsing ${files.length} files...`);
      const entities: CodeEntity[] = [];
      for (const file of files) {
        try {
          entities.push(...await parseFile(file));
        } catch { /* skip */ }
      }
      console.log(`   Found ${entities.length} entities\n`);

      // 2. Build index
      console.log('🧬 Building semantic index...');
      const config: EmbeddingConfig = {
        ...DEFAULT_EMBEDDING_CONFIG,
        model: opts.model as 'openai' | 'voyage-code-2',
      };

      const index = await buildSemanticIndex(entities, config, (stage, cur, total) => {
        if (stage === 'Generating embeddings') {
          const pct = Math.round((cur / total) * 100);
          process.stdout.write(`\r   [${'█'.repeat(Math.floor(pct / 5))}${'░'.repeat(20 - Math.floor(pct / 5))}] ${pct}%`);
        }
      });
      console.log('\n');

      // 3. Search
      console.log(`🔎 Searching: "${query}"\n`);

      const result = opts.byName
        ? searchByName(query, index.store, index.graph, parseInt(opts.depth))
        : await semanticSearch(query, index.store, index.graph, {
            topK: parseInt(opts.topK),
            expandDepth: parseInt(opts.depth),
            model: opts.model as 'openai' | 'voyage-code-2',
          });

      // 4. Display
      console.log(formatSearchResults(result, index.graph, { includeCode: opts.code }));
      console.log('\n✅ Done!\n');
    } catch (err) {
      console.error('\n❌ Error:', err);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
