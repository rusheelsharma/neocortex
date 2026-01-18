// ============================================================================
// FILE: mcp/tools/index_repo.ts
// PURPOSE: Clone and index a GitHub repository for code search with embeddings
// ============================================================================

import { Tool, SchemaConstraint, Optional } from '@leanmcp/core';
import { store, generateRepoId, IndexedRepository } from '../store.js';
import { cloneRepository, getSourceFiles, getRepoInfo } from '../../src/clone.js';
import { parseFile } from '../../src/parser.js';
import { buildDependencyGraph, getGraphStats } from '../../src/graph.js';
import { 
  embedEntities, 
  VectorStore, 
  DEFAULT_EMBEDDING_CONFIG,
  EmbeddingConfig 
} from '../../src/embeddings.js';
import { simpleGit } from 'simple-git';
import * as path from 'path';

/**
 * Input schema for index_repo tool
 */
class IndexRepoInput {
  @SchemaConstraint({
    description: 'GitHub repository URL (e.g., https://github.com/owner/repo)'
  })
  repo_url!: string;

  @Optional()
  @SchemaConstraint({
    description: 'GitHub personal access token for private repositories'
  })
  token?: string;

  @Optional()
  @SchemaConstraint({
    description: 'File extensions to index (default: [".ts", ".tsx", ".js", ".jsx"])',
    default: ['.ts', '.tsx', '.js', '.jsx']
  })
  extensions?: string[];

  @Optional()
  @SchemaConstraint({
    description: 'Patterns to exclude (default: ["node_modules", "dist", "*.test.*", "*.spec.*"])',
    default: ['node_modules', 'dist', '*.test.*', '*.spec.*']
  })
  exclude_patterns?: string[];

  @Optional()
  @SchemaConstraint({
    description: 'Skip embedding generation (faster but no semantic search)',
    default: false
  })
  skip_embeddings?: boolean;
}

/**
 * IndexRepoService - Clone and index GitHub repositories with semantic embeddings
 * 
 * This is the primary entry point for indexing a codebase. It:
 * 1. Clones the repository (or pulls latest if already cloned)
 * 2. Discovers all source files matching extensions
 * 3. Parses each file to extract code entities
 * 4. Builds a dependency graph
 * 5. Generates semantic embeddings with OpenAI (if API key available)
 * 6. Stores everything in the in-memory store
 */
export class IndexRepoService {
  @Tool({
    description: 'Clone and index a GitHub repository for semantic code search. Generates embeddings using OpenAI for high-quality search results. Returns a repo_id to use with search_code, resolve_symbol, and get_snippet tools.',
    inputClass: IndexRepoInput
  })
  async index_repo(input: IndexRepoInput) {
    try {
      // Check if repo is already indexed by URL
      const existingRepo = store.getByUrl(input.repo_url);
      if (existingRepo) {
        const hasEmbeddings = existingRepo.vectorStore !== null;
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'already_indexed',
              repo_id: existingRepo.repoId,
              repo_url: existingRepo.repoUrl,
              entities: existingRepo.entities.length,
              has_embeddings: hasEmbeddings,
              indexed_at: existingRepo.indexedAt.toISOString(),
              message: `Repository is already indexed${hasEmbeddings ? ' with semantic embeddings' : ' (keyword search only)'}. Use the repo_id for search operations.`
            }, null, 2)
          }]
        };
      }

      // Handle DEMO_MODE
      if (process.env.DEMO_MODE === 'true') {
        return this.getDemoResponse(input);
      }

      const repoInfo = getRepoInfo(input.repo_url);
      const extensions = input.extensions ?? ['.ts', '.tsx', '.js', '.jsx'];
      const excludePatterns = input.exclude_patterns ?? [
        'node_modules', 'dist', 'build', '.git',
        '*.test.*', '*.spec.*', '__tests__', '__mocks__'
      ];
      const skipEmbeddings = input.skip_embeddings ?? false;

      // Step 1: Clone repository
      console.log(`📥 Cloning ${repoInfo.fullName}...`);
      const localPath = await cloneRepository(input.repo_url, input.token);

      // Step 2: Get git SHA
      const git = simpleGit(localPath);
      const log = await git.log({ maxCount: 1 });
      const gitSha = log.latest?.hash ?? 'unknown';

      // Step 3: Discover source files
      console.log(`🔍 Discovering source files...`);
      const files = await getSourceFiles(localPath, extensions, excludePatterns);
      console.log(`📁 Found ${files.length} source files`);

      if (files.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'error',
              error: 'No source files found',
              hint: `No files matching extensions ${extensions.join(', ')} were found. Try different extensions or check exclude patterns.`,
              local_path: localPath
            }, null, 2)
          }],
          isError: true
        };
      }

      // Step 4: Parse files and extract entities
      console.log(`🔬 Parsing source files...`);
      const allEntities = [];
      let parsedFiles = 0;
      let failedFiles = 0;

      for (const file of files) {
        try {
          const entities = await parseFile(file);
          // Convert absolute paths to relative paths
          for (const entity of entities) {
            entity.file = path.relative(localPath, entity.file);
            entity.id = `${entity.file}:${entity.name}:${entity.startLine}`;
          }
          allEntities.push(...entities);
          parsedFiles++;
        } catch (error) {
          // Log but don't fail - some files might have syntax errors
          console.warn(`⚠️  Failed to parse ${file}: ${error}`);
          failedFiles++;
        }
      }

      console.log(`✅ Extracted ${allEntities.length} entities from ${parsedFiles} files`);

      if (allEntities.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'error',
              error: 'No code entities extracted',
              hint: 'Files were found but no functions, classes, or types could be extracted. The repository may use an unsupported syntax.',
              files_found: files.length,
              files_parsed: parsedFiles,
              files_failed: failedFiles
            }, null, 2)
          }],
          isError: true
        };
      }

      // Step 5: Build dependency graph
      console.log(`🔗 Building dependency graph...`);
      const graph = buildDependencyGraph(allEntities);
      const graphStats = getGraphStats(graph);

      // Step 6: Generate embeddings (if API key available and not skipped)
      let vectorStore: VectorStore | null = null;
      let embeddingStats: { generated: number; model: string } | null = null;

      // Check for LeanMCP or OpenAI API key
      const leanmcpApiKey = process.env.LEANMCP_API_KEY || process.env.AI_GATEWAY_API_KEY;
      const openaiApiKey = process.env.OPENAI_API_KEY;
      const hasApiKey = !!(leanmcpApiKey || openaiApiKey);
      
      // Generate session ID for LeanMCP observability (track all embedding requests for this indexing session)
      const sessionId = `neocortex-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      if (!skipEmbeddings && hasApiKey) {
        // Determine if using LeanMCP based on which API key is set
        const isUsingLeanMCP = !!leanmcpApiKey;
        const modelSource = isUsingLeanMCP ? 'LeanMCP' : 'OpenAI';
        console.log(`🧬 Generating semantic embeddings with ${modelSource}...`);
        if (isUsingLeanMCP) {
          console.log(`   📊 Session ID: ${sessionId} (for observability)`);
        }
        try {
          const config: EmbeddingConfig = {
            ...DEFAULT_EMBEDDING_CONFIG,
            model: 'openai',
          };

          const embeddings = await embedEntities(
            allEntities,
            graph,
            config,
            (current, total) => {
              const percent = Math.round((current / total) * 100);
              process.stdout.write(`\r   [${('█').repeat(Math.floor(percent / 5))}${('░').repeat(20 - Math.floor(percent / 5))}] ${percent}%`);
            },
            sessionId  // Pass session ID for observability
          );
          console.log(''); // New line after progress bar

          vectorStore = new VectorStore();
          vectorStore.addBatch(embeddings);
          
          embeddingStats = {
            generated: embeddings.length,
            model: isUsingLeanMCP ? 'leanmcp' : 'openai'
          };
          
          console.log(`✅ Generated ${embeddings.length} embeddings`);
        } catch (embeddingError) {
          console.warn(`⚠️  Failed to generate embeddings: ${embeddingError}`);
          console.warn(`   Falling back to keyword-only search`);
        }
      } else if (!hasApiKey && !skipEmbeddings) {
        console.log(`⚠️  LEANMCP_API_KEY or OPENAI_API_KEY not set - skipping embeddings (keyword search only)`);
      }

      // Step 7: Generate repo ID and store
      const repoId = generateRepoId(input.repo_url);
      const indexedRepo: IndexedRepository = {
        repoId,
        repoUrl: input.repo_url,
        localPath,
        gitSha,
        entities: allEntities,
        graph,
        vectorStore,
        indexedAt: new Date(),
        sessionId: hasApiKey ? sessionId : undefined  // Store session ID for search queries
      };

      store.add(indexedRepo);

      console.log(`✅ Repository indexed successfully: ${repoId}`);

      // Prepare response with useful stats
      const entityBreakdown = {
        functions: allEntities.filter(e => e.type === 'function').length,
        classes: allEntities.filter(e => e.type === 'class').length,
        methods: allEntities.filter(e => e.type === 'method').length,
        interfaces: allEntities.filter(e => e.type === 'interface').length,
        types: allEntities.filter(e => e.type === 'type').length
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'success',
            repo_id: repoId,
            repo_url: input.repo_url,
            repo_name: repoInfo.fullName,
            git_sha: gitSha,
            indexed_at: indexedRepo.indexedAt.toISOString(),
            stats: {
              files_found: files.length,
              files_parsed: parsedFiles,
              files_failed: failedFiles,
              total_entities: allEntities.length,
              entity_breakdown: entityBreakdown,
              graph: {
                total_edges: graphStats.totalEdges,
                avg_dependencies: graphStats.avgDependencies.toFixed(2),
                most_called: graphStats.mostCalled.slice(0, 3)
              },
              embeddings: embeddingStats ?? { generated: 0, model: 'none', reason: hasApiKey ? 'skipped' : 'LEANMCP_API_KEY or OPENAI_API_KEY not set' }
            },
            search_mode: vectorStore ? 'semantic' : 'keyword',
            message: `Successfully indexed ${repoInfo.fullName}. Use repo_id "${repoId}" for search operations. ${vectorStore ? 'Semantic search enabled.' : 'Keyword search only (set LEANMCP_API_KEY or OPENAI_API_KEY for semantic search).'}`
          }, null, 2)
        }]
      };
    } catch (error) {
      // Handle demo mode fallback
      if (process.env.DEMO_MODE === 'true') {
        return this.getDemoResponse(input);
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            status: 'error',
            error: errorMessage,
            hint: errorMessage.includes('not found')
              ? 'Make sure the repository URL is correct and the repo is public (or provide a token for private repos).'
              : errorMessage.includes('Authentication')
              ? 'Authentication failed. Provide a valid GitHub token for private repositories.'
              : errorMessage.includes('API_KEY') || errorMessage.includes('OPENAI_API_KEY')
              ? 'Set the LEANMCP_API_KEY or OPENAI_API_KEY environment variable for semantic search, or use skip_embeddings: true.'
              : 'An unexpected error occurred during indexing.'
          }, null, 2)
        }],
        isError: true
      };
    }
  }

  /**
   * getDemoResponse - Return stub response for demo mode
   */
  private getDemoResponse(input: IndexRepoInput) {
    const repoInfo = getRepoInfo(input.repo_url);
    const demoRepoId = `${repoInfo.owner}-${repoInfo.repo}-demo`;

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          status: 'demo_mode',
          repo_id: demoRepoId,
          repo_url: input.repo_url,
          repo_name: repoInfo.fullName,
          git_sha: 'abc123demo',
          indexed_at: new Date().toISOString(),
          stats: {
            files_found: 42,
            files_parsed: 40,
            files_failed: 2,
            total_entities: 234,
            entity_breakdown: {
              functions: 120,
              classes: 15,
              methods: 67,
              interfaces: 22,
              types: 10
            },
            graph: {
              total_edges: 456,
              avg_dependencies: '3.45',
              most_called: [
                { name: 'utils', count: 25 },
                { name: 'logger', count: 18 },
                { name: 'config', count: 12 }
              ]
            },
            embeddings: {
              generated: 234,
              model: 'openai'
            }
          },
          search_mode: 'semantic',
          message: 'Demo mode - returning example response. In production, the repository would be cloned and indexed with embeddings.'
        }, null, 2)
      }]
    };
  }
}
