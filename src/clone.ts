// ============================================================================
// FILE: src/clone.ts
// PURPOSE: Git clone operations and source file discovery
// ============================================================================

import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';

// ----------------------------------------------------------------------------
// SECTION 2.2.1: CONSTANTS
// ----------------------------------------------------------------------------

/**
 * TEMP_DIR - Directory where repositories are cloned
 * 
 * Uses CACHE_DIR env var if set (Lambda uses /tmp/repos), otherwise ./temp
 * Lambda only allows writes to /tmp, so CACHE_DIR must point there.
 * This directory should be gitignored.
 */
const TEMP_DIR = process.env.CACHE_DIR || './temp';

// ----------------------------------------------------------------------------
// SECTION 2.2.2: AUTHENTICATION
// ----------------------------------------------------------------------------

/**
 * getAuthToken - Get GitHub authentication token from options or environment
 * 
 * Priority: 1) Explicit token parameter, 2) GITHUB_TOKEN env var
 * 
 * @param optionsToken - Token passed via CLI option
 * @returns Token string or undefined
 */
export function getAuthToken(optionsToken?: string): string | undefined {
  return optionsToken || process.env.GITHUB_TOKEN;
}

// ----------------------------------------------------------------------------
// SECTION 2.2.3: REPOSITORY CLONING
// ----------------------------------------------------------------------------

/**
 * cloneRepository - Clone a GitHub repository to local temp directory
 * 
 * This function handles the first step of the pipeline: getting the code
 * locally so we can parse it. It's smart about caching - if the repo
 * was already cloned, it just pulls the latest changes.
 * 
 * @param repoUrl - Full GitHub URL (https://github.com/owner/repo)
 * @param token - Optional GitHub personal access token for private repos
 * @returns Path to the cloned repository directory
 * 
 * FEATURES:
 * - Shallow clone (--depth 1) for speed - we only need current state
 * - Single branch only - we don't need history
 * - Caches cloned repos - subsequent runs are faster
 * - Pulls latest if repo exists - keeps data fresh
 * - Supports private repos via GitHub PAT
 * 
 * EXAMPLE:
 * const repoPath = await cloneRepository('https://github.com/shadcn/ui');
 * // Returns: './temp/shadcn-ui'
 * 
 * // For private repos:
 * const repoPath = await cloneRepository('https://github.com/org/private-repo', 'ghp_xxxx');
 */
export async function cloneRepository(repoUrl: string, token?: string): Promise<string> {
  // Log the cache directory being used (helps debug Lambda vs local)
  console.log(`📂 Using cache directory: ${TEMP_DIR}`);
  
  // Ensure temp directory exists
  // recursive: true means it won't error if directory exists
  await fs.mkdir(TEMP_DIR, { recursive: true });

  // Extract a safe directory name from the URL
  const repoName = extractRepoName(repoUrl);
  const targetPath = path.join(TEMP_DIR, repoName);

  // Create authenticated URL if token provided
  // SECURITY: Never log cloneUrl - it contains the token!
  let cloneUrl = repoUrl;
  if (token) {
    try {
      const url = new URL(repoUrl);
      url.username = token;
      cloneUrl = url.toString();
    } catch {
      throw new Error(`Token auth only supported for HTTPS URLs. Got: ${repoUrl}`);
    }
  }

  // Check if repository was already cloned
  try {
    await fs.access(targetPath);
    
    // Directory exists - pull latest changes instead of re-cloning
    console.log(`📁 Repository already exists at ${targetPath}`);
    
    const git = simpleGit(targetPath);
    console.log('🔄 Pulling latest changes...');
    
    try {
      // If token provided, update remote URL with auth before pulling
      if (token) {
        try {
          const url = new URL(repoUrl);
          url.username = token;
          await git.remote(['set-url', 'origin', url.toString()]);
        } catch {
          // Ignore URL parse errors for pull
        }
      }
      await git.pull();
      console.log('✅ Updated to latest');
    } catch (pullError) {
      // Pull might fail if there are local changes or detached HEAD
      // That's okay - we still have the code to parse
      console.log('⚠️  Could not pull (using existing code)');
    }
    
    return targetPath;
  } catch {
    // Directory doesn't exist - need to clone
  }

  // Clone the repository
  // SECURITY: Log original URL, not cloneUrl (which may contain token)
  console.log(`🔍 Cloning ${repoUrl}...`);
  if (token) {
    console.log('🔐 Using authenticated access');
  }

  const git: SimpleGit = simpleGit();

  try {
    await git.clone(cloneUrl, targetPath, [
      '--depth', '1',        // Shallow clone - only latest commit
      '--single-branch',     // Only the default branch
    ]);
    
    console.log(`✅ Cloned to ${targetPath}`);
  } catch (cloneError) {
    // Provide helpful error messages for common issues
    const errorMessage = (cloneError as Error).message || String(cloneError);
    
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      throw new Error(`Repository not found: ${repoUrl}\nMake sure the URL is correct and the repo is public (or provide a token for private repos).`);
    }
    
    if (errorMessage.includes('Authentication') || errorMessage.includes('403')) {
      throw new Error(`Authentication failed for: ${repoUrl}\nFor private repos, use --token flag or set GITHUB_TOKEN env var.`);
    }
    
    throw new Error(`Failed to clone repository: ${errorMessage}`);
  }

  return targetPath;
}

/**
 * extractRepoName - Extract a safe directory name from a GitHub URL
 * 
 * Handles multiple URL formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - https://github.com/owner/repo/
 * 
 * @param url - GitHub repository URL
 * @returns Safe directory name like "owner-repo"
 * 
 * EXAMPLES:
 * extractRepoName('https://github.com/shadcn/ui') -> 'shadcn-ui'
 * extractRepoName('git@github.com:vercel/next.js.git') -> 'vercel-next.js'
 */
function extractRepoName(url: string): string {
  // Remove .git suffix and trailing slashes
  let cleaned = url
    .replace(/\.git$/, '')
    .replace(/\/$/, '');

  // Split by / or : to handle both HTTPS and SSH URLs
  // Filter out empty strings from the split
  const parts = cleaned.split(/[\/:]/).filter(Boolean);

  // Last two parts are owner and repo
  // e.g., ['https:', 'github.com', 'owner', 'repo'] -> owner, repo
  const owner = parts[parts.length - 2] || 'unknown';
  const repo = parts[parts.length - 1] || 'repo';

  // Combine with hyphen for a safe directory name
  return `${owner}-${repo}`;
}

// ----------------------------------------------------------------------------
// SECTION 2.2.4: SOURCE FILE DISCOVERY
// ----------------------------------------------------------------------------

/**
 * getSourceFiles - Recursively find all source files in a repository
 * 
 * Walks the directory tree starting from repoPath and collects all files
 * matching the specified extensions, excluding files that match any
 * exclude pattern.
 * 
 * @param repoPath - Root directory to search
 * @param extensions - File extensions to include (e.g., ['.ts', '.tsx'])
 * @param excludePatterns - Patterns to exclude (e.g., ['node_modules', '*.test.ts'])
 * @returns Array of absolute file paths
 * 
 * ALGORITHM:
 * 1. Start at repoPath
 * 2. For each entry in directory:
 *    a. If it matches an exclude pattern, skip it
 *    b. If it's a directory, recurse into it
 *    c. If it's a file with matching extension, add to results
 * 3. Return all collected file paths
 * 
 * EXAMPLE:
 * const files = await getSourceFiles('./temp/shadcn-ui', ['.ts', '.tsx'], ['node_modules']);
 * // Returns: ['./temp/shadcn-ui/src/button.tsx', './temp/shadcn-ui/src/utils.ts', ...]
 */
export async function getSourceFiles(
  repoPath: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx'],
  excludePatterns: string[] = []
): Promise<string[]> {
  const files: string[] = [];

  /**
   * walkDir - Recursive helper function to traverse directories
   * 
   * Uses async/await for non-blocking file system operations.
   * This is important for large repositories with thousands of files.
   */
  async function walkDir(dir: string): Promise<void> {
    // Read directory contents
    // withFileTypes: true gives us Dirent objects with isFile/isDirectory methods
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Get path relative to repo root for pattern matching
      const relativePath = path.relative(repoPath, fullPath);

      // Check if this path should be excluded
      if (shouldExclude(relativePath, entry.name, excludePatterns)) {
        continue; // Skip this entry entirely
      }

      if (entry.isDirectory()) {
        // Recurse into subdirectory
        await walkDir(fullPath);
      } else if (entry.isFile()) {
        // Check if file extension matches
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
      // Symbolic links and other types are ignored
    }
  }

  // Start the recursive walk
  await walkDir(repoPath);

  // Sort for consistent ordering (helps with reproducibility)
  files.sort();

  return files;
}

/**
 * shouldExclude - Check if a file/directory should be excluded
 * 
 * Supports multiple pattern types:
 * - Exact match: 'node_modules' matches 'node_modules' directory
 * - Prefix wildcard: '*.test.ts' matches 'button.test.ts'
 * - Suffix wildcard: 'test*' matches 'test-utils.ts'
 * - Contains: 'coverage' matches 'path/to/coverage/file.ts'
 * 
 * @param relativePath - Path relative to repo root
 * @param fileName - Just the file/directory name
 * @param patterns - Array of exclude patterns
 * @returns true if should be excluded, false otherwise
 */
function shouldExclude(
  relativePath: string,
  fileName: string,
  patterns: string[]
): boolean {
  for (const pattern of patterns) {
    // Pattern starting with * - match file extension or suffix
    // Example: '*.test.ts' should match 'button.test.ts'
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1); // Remove the *
      if (fileName.endsWith(suffix) || relativePath.endsWith(suffix)) {
        return true;
      }
      continue;
    }

    // Pattern ending with * - match prefix
    // Example: 'test*' should match 'test-utils.ts'
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1); // Remove the *
      if (fileName.startsWith(prefix) || relativePath.startsWith(prefix)) {
        return true;
      }
      continue;
    }

    // Exact match or contains
    // Example: 'node_modules' should match 'path/to/node_modules/file.ts'
    if (
      fileName === pattern ||           // Exact file/dir name match
      relativePath === pattern ||       // Exact path match
      relativePath.includes(`/${pattern}/`) ||  // Contains as directory
      relativePath.startsWith(`${pattern}/`) || // Starts with pattern
      relativePath.includes(pattern)    // Contains pattern anywhere
    ) {
      return true;
    }
  }

  return false;
}

// ----------------------------------------------------------------------------
// SECTION 2.2.5: CLEANUP UTILITIES
// ----------------------------------------------------------------------------

/**
 * cleanupRepository - Remove a cloned repository
 * 
 * Useful for freeing disk space after processing or during testing.
 * Uses recursive removal to delete the entire directory tree.
 * 
 * @param repoPath - Path to the repository to delete
 * 
 * CAUTION: This permanently deletes files! Make sure repoPath
 * is within the temp directory.
 */
export async function cleanupRepository(repoPath: string): Promise<void> {
  // Safety check - only delete from temp directory
  const normalizedPath = path.normalize(repoPath);
  const normalizedTemp = path.normalize(TEMP_DIR);
  
  if (!normalizedPath.startsWith(normalizedTemp)) {
    throw new Error(`Safety check failed: ${repoPath} is not in temp directory`);
  }

  await fs.rm(repoPath, { recursive: true, force: true });
  console.log(`🧹 Cleaned up ${repoPath}`);
}

/**
 * cleanupAllRepositories - Remove all cloned repositories
 * 
 * Deletes the entire temp directory. Useful for starting fresh.
 */
export async function cleanupAllRepositories(): Promise<void> {
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    console.log('🧹 Cleaned up all temporary repositories');
  } catch (error) {
    // Directory might not exist - that's fine
    console.log('📁 No temporary repositories to clean up');
  }
}

// ----------------------------------------------------------------------------
// SECTION 2.2.6: UTILITY FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * getRepoInfo - Extract information about a repository URL
 * 
 * Useful for display purposes and generating output filenames.
 * 
 * @param repoUrl - GitHub repository URL
 * @returns Object with owner, repo name, and full name
 */
export function getRepoInfo(repoUrl: string): {
  owner: string;
  repo: string;
  fullName: string;
} {
  const cleaned = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
  const parts = cleaned.split(/[\/:]/).filter(Boolean);
  
  const owner = parts[parts.length - 2] || 'unknown';
  const repo = parts[parts.length - 1] || 'repo';
  
  return {
    owner,
    repo,
    fullName: `${owner}/${repo}`,
  };
}

/**
 * isValidGitHubUrl - Validate that a URL looks like a GitHub repository
 * 
 * @param url - URL to validate
 * @returns true if URL appears to be a valid GitHub repo URL
 */
export function isValidGitHubUrl(url: string): boolean {
  // Match common GitHub URL patterns
  const patterns = [
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/,
    /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\.git$/,
    /^git@github\.com:[\w.-]+\/[\w.-]+\.git$/,
  ];
  
  return patterns.some(pattern => pattern.test(url));
}
