#!/usr/bin/env node
// ============================================================================
// FILE: src/index.ts
// PURPOSE: CLI entry point for Neocortex
// ============================================================================

import { Command } from 'commander';
import { cloneRepository, getSourceFiles } from './clone.js';
import { parseFile } from './parser.js';
import { generateAllExamples, prepareDataset } from './generator.js';
import { writeJSONL, writeDatasetSplits, writeStats, formatStats, calculateStats } from './output.js';
import { CodeEntity, GeneratorConfig, DEFAULT_CONFIG } from './types.js';

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

// Parse command line arguments
program.parse();
