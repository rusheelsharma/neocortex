# Neocortex - Architecture & Codebase Documentation

## Overview

**Neocortex** is a CLI tool that transforms GitHub repositories into high-quality training data for Small Language Models (SLMs). It automatically extracts code entities (functions, classes, interfaces, types) from TypeScript/JavaScript repositories and generates instruction-context-response pairs in JSONL format, ready for fine-tuning.

### What It Does

1. **Clones** a GitHub repository locally
2. **Scans** for TypeScript/JavaScript source files
3. **Parses** each file using tree-sitter AST parser
4. **Extracts** code entities (functions, classes, interfaces, types, methods)
5. **Generates** Q&A pairs about each entity using templates
6. **Writes** everything to JSONL format ready for fine-tuning

### Input/Output

- **INPUT**: GitHub repository URL (e.g., `https://github.com/user/repo`)
- **OUTPUT**: JSONL file with training examples + statistics JSON file

---

## Architecture Overview

The tool follows a **pipeline architecture** with 5 distinct stages:

```
GitHub Repo URL
    ↓
[1. CLONE] → Local repository in ./temp/
    ↓
[2. SCAN] → Array of source file paths
    ↓
[3. PARSE] → Array of CodeEntity objects
    ↓
[4. GENERATE] → Array of TrainingExample objects
    ↓
[5. WRITE] → JSONL file + stats JSON
```

### Data Flow

```
Repository URL
    ↓
clone.ts → repoPath (string)
    ↓
clone.ts → filePaths (string[])
    ↓
parser.ts → entities (CodeEntity[])
    ↓
generator.ts → examples (TrainingExample[])
    ↓
output.ts → JSONL file
```

---

## File Structure

```
neocortex/
├── src/
│   ├── index.ts          # CLI entry point (Commander.js)
│   ├── types.ts          # TypeScript type definitions
│   ├── clone.ts          # Git operations & file discovery
│   ├── parser.ts         # AST parsing with tree-sitter
│   ├── templates.ts      # Question templates
│   ├── generator.ts      # Example generation
│   ├── output.ts         # File writing & statistics
│   └── extractor.ts      # (Empty file - not currently used)
├── output/               # Generated JSONL files (gitignored)
├── temp/                 # Cloned repositories (gitignored)
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## Core Files Explained

### 1. `src/types.ts` - Type Definitions

**Purpose**: Defines all TypeScript interfaces and types used throughout the project. This is the "data dictionary" that defines the shape of all data flowing through the system.

**Key Types**:

- **`EntityType`**: Enumeration of code structures (`'function' | 'class' | 'method' | 'interface' | 'type' | 'variable' | 'enum'`)
  - Note: `'variable'` and `'enum'` are defined but not currently extracted by the parser
- **`CodeEntity`**: Core data structure representing an extracted code element
  - Contains: id, name, type, file path, line numbers, code, signature, docstring, parameters, return type, complexity metrics
- **`TrainingExample`**: Output format for JSONL
  - Contains: `instruction` (question), `context` (code snippet), `response` (answer), optional `metadata`
- **`GeneratorConfig`**: All configuration options (CLI flags, parsing options, generation settings)
- **`GenerationStats`**: Summary statistics (files processed, entities found, examples generated, tokens, cost)

**Why it matters**: Every other file imports from here. It's the foundation that ensures type safety across the entire pipeline.

---

### 2. `src/clone.ts` - Git Operations & File Discovery

**Purpose**: Handles all Git operations and file system traversal.

**Key Functions**:

- **`cloneRepository(repoUrl: string)`**: 
  - Clones a GitHub repository to `./temp/` directory
  - Uses shallow clone (`--depth 1`) for speed
  - If repo already exists, pulls latest changes instead of re-cloning
  - Returns path to cloned repository

- **`getSourceFiles(repoPath, extensions, excludePatterns)`**:
  - Recursively walks directory tree
  - Finds all files matching extensions (`.ts`, `.tsx`, `.js`, `.jsx`)
  - Filters out files matching exclude patterns (`node_modules`, `*.test.ts`, etc.)
  - Returns array of absolute file paths

- **`getRepoInfo(repoUrl)`**: Extracts owner/repo name from URL
- **`cleanupRepository(repoPath)`**: Removes cloned repository (safety-checked)

**Dependencies**: 
- `simple-git` for Git operations
- Node.js `fs/promises` for file system operations

---

### 3. `src/parser.ts` - AST Parsing

**Purpose**: The **CORE** of the tool. Parses source files into Abstract Syntax Trees (AST) and extracts code entities.

**How It Works**:

1. Uses **tree-sitter** parser with TypeScript grammar
2. Parses file content into AST
3. Walks the AST tree recursively
4. Identifies entity nodes (function_declaration, class_declaration, etc.)
5. Extracts metadata for each entity

**Key Functions**:

- **`parseFile(filePath)`**: Main entry point - parses a file and returns `CodeEntity[]`
- **`extractEntity(node, filePath, content)`**: Dispatcher that routes to specific extractors based on node type
- **`extractFunction()`**: Extracts function entities (handles function declarations, arrow functions, function expressions)
- **`extractClass()`**: Extracts class entities with methods and properties
- **`extractInterface()`**: Extracts TypeScript interface entities
- **`extractTypeAlias()`**: Extracts TypeScript type aliases
- **`extractMethod()`**: Extracts methods from inside classes (prefixed with class name)

**Helper Functions**:

- **`extractDocstring()`**: Finds JSDoc comments above entities
- **`extractParameters()`**: Extracts function parameters with types and optional flags
- **`extractFunctionCalls()`**: Finds all function calls within an entity
- **`calculateComplexity()`**: Calculates cyclomatic complexity (measures code complexity)
- **`estimateTokens()`**: Rough token count estimation (chars / 4)

**What Gets Extracted**:

For each entity, the parser extracts:
- Name, type, file path, line numbers
- Full source code
- Function signature
- JSDoc docstring (if present)
- Parameters with types
- Return type annotation
- Function calls made within
- Complexity score
- Methods/properties (for classes/interfaces)

**Dependencies**: `tree-sitter`, `tree-sitter-typescript` (native bindings)

**Important Limitation**: The parser currently only uses the TypeScript grammar (`TypeScript.typescript`), not the TSX grammar (`TypeScript.tsx`). This means:
- `.ts` files are parsed correctly
- `.tsx` files with JSX may not parse correctly (React components might not be extracted properly)
- To fix this, you would need to detect file extension and use `TypeScript.tsx` for `.tsx` files

---

### 4. `src/templates.ts` - Question Templates

**Purpose**: Defines question templates that convert `CodeEntity` → `TrainingExample`. Each template specifies how to generate a specific type of question.

**Key Structure**:

```typescript
interface QuestionTemplate {
  type: QuestionType;           // 'explain_function', 'list_parameters', etc.
  difficulty: 'easy' | 'medium' | 'hard';
  applicableTo: EntityType[];   // Which entity types this applies to
  instruction: (entity) => string;      // Generates the question
  generateResponse: (entity) => string; // Generates the answer
}
```

**Available Templates** (9 total):

**Easy Questions** (for functions/methods):
1. **`explain_function`**: "What does `functionName` do?"
2. **`list_parameters`**: "What are the parameters of `functionName`?"
3. **`explain_return`**: "What does `functionName` return?"
4. **`list_dependencies`**: "What functions does `functionName` call?"

**Medium Questions** (for functions/methods):
5. **`usage_example`**: "Show an example of using `functionName`"
6. **`error_handling`**: "What errors might `functionName` throw?"

**Hard Questions** (for functions/methods):
7. **`suggest_improvement`**: "How could `functionName` be improved?"

**Class Templates**:
8. **`explain_function`** (for classes): "What is the `ClassName` class?"

**Interface/Type Templates**:
9. **`explain_type`**: "What does `typeName` define?" (for interfaces/types)

**Key Function**:
- **`getTemplatesForEntity(entity)`**: Returns all templates applicable to an entity's type

**How Responses Are Generated**:

- Uses docstring if available
- Falls back to extracting info from entity metadata (parameters, return type, calls, etc.)
- Formats responses in natural language

---

### 5. `src/generator.ts` - Example Generation

**Purpose**: Applies templates to entities and produces `TrainingExample` objects.

**Key Functions**:

- **`generateExamplesForEntity(entity, config)`**:
  - Gets applicable templates for the entity
  - Limits to `config.questionsPerEntity` (default: 5)
  - For each template:
    - Generates instruction (question)
    - Generates response (answer)
    - Builds context (file path + code)
    - Creates `TrainingExample` with optional metadata
  - Filters out low-quality responses (< 20 chars)
  - Returns array of examples

- **`generateAllExamples(entities, config, onProgress)`**:
  - Filters entities by line count (min/max limits)
  - Processes each entity through `generateExamplesForEntity()`
  - Calls progress callback for UI updates
  - Returns all generated examples

- **`prepareDataset(examples, config)`**:
  - Shuffles examples randomly
  - If `splitRatio` configured, splits into train/val/test sets
  - Returns dataset object

**Data Transformation**:

```
CodeEntity → [Template] → TrainingExample
  (1 entity)    (5 templates)   (5 examples)
```

---

### 6. `src/output.ts` - File Writing & Statistics

**Purpose**: Handles writing JSONL files and calculating/formatting statistics.

**Key Functions**:

- **`writeJSONL(examples, outputPath)`**:
  - Converts `TrainingExample[]` to JSONL format (one JSON object per line)
  - Creates output directory if needed
  - Writes to file

- **`writeDatasetSplits(dataset, basePath)`**:
  - Writes train/val/test splits to separate files
  - Returns array of written file paths

- **`calculateStats(repoName, filesProcessed, entities, examples, startTime)`**:
  - Counts entities by type (functions, classes, interfaces, types)
  - Estimates total tokens (chars / 4)
  - Calculates estimated cost
  - Measures processing time
  - Returns `GenerationStats` object

- **`formatStats(stats)`**: Formats statistics for console display

- **`writeStats(stats, outputPath)`**: Writes stats to JSON file

**Output Format**:

Each line in JSONL file is a JSON object:
```json
{
  "instruction": "What does the `add` function do?",
  "context": "// File: src/utils.ts\nfunction add(a: number, b: number): number { return a + b; }",
  "response": "The `add` function takes 2 parameter(s): a, b and returns `number`.",
  "metadata": {
    "source_file": "src/utils.ts",
    "entity_name": "add",
    "entity_type": "function",
    "question_type": "explain_function",
    "difficulty": "easy"
  }
}
```

---

### 7. `src/index.ts` - CLI Entry Point

**Purpose**: Command-line interface using Commander.js. Orchestrates the entire pipeline.

**Commands**:

1. **`generate <repo-url>`** - Full pipeline:
   - Clones repository
   - Scans for files
   - Parses files
   - Generates examples
   - Writes JSONL + stats
   - Shows progress bars and statistics

   **Options**:
   - `-o, --output <path>`: Output path (default: `./output/training.jsonl`)
   - `-q, --questions <n>`: Questions per entity (default: 5)
   - `--split`: Split into train/val/test (80/10/10)
   - `--no-metadata`: Exclude metadata from output
   - `--min-lines <n>`: Minimum function lines (default: 3)
   - `--max-lines <n>`: Maximum function lines (default: 200)

2. **`preview <repo-url>`** - Preview without writing:
   - Clones and parses first 10 files
   - Generates 3 examples per entity
   - Prints Q&A pairs to console
   - Doesn't write files

3. **`stats <file>`** - Analyze existing JSONL:
   - Reads JSONL file
   - Shows breakdown by question type and difficulty

**Pipeline Execution** (in `generate` command):

```typescript
1. cloneRepository(repoUrl) → repoPath
2. getSourceFiles(repoPath, extensions, excludePatterns) → files[]
3. for each file: parseFile(file) → entities[]
4. generateAllExamples(entities, config) → examples[]
5. prepareDataset(examples, config) → dataset
6. writeJSONL/writeDatasetSplits() → files written
7. calculateStats() → stats
8. writeStats() → stats.json
```

---

## Data Structures

### CodeEntity

Represents a single extracted code element:

```typescript
{
  id: "filepath:name:startLine",  // Unique identifier
  name: "add",                     // Function/class name
  type: "function",                // Entity type
  file: "src/utils.ts",            // Source file path
  startLine: 10,                   // 1-indexed start line
  endLine: 15,                     // 1-indexed end line
  code: "function add(...) {...}", // Full source code
  signature: "add(a: number, b: number): number",
  docstring: "Adds two numbers",   // JSDoc comment or null
  tokens: 25,                      // Estimated token count
  complexity: 1,                   // Cyclomatic complexity
  calls: ["parseInt", "Math.max"], // Functions called
  parameters: [                    // Function parameters
    { name: "a", type: "number", optional: false, defaultValue: null }
  ],
  returnType: "number",            // Return type or null
  methods: ["add", "subtract"],    // For classes only
  properties: ["value"]             // For classes/interfaces only
}
```

### TrainingExample

Represents a single training example:

```typescript
{
  instruction: "What does the `add` function do?",
  context: "// File: src/utils.ts\nfunction add(a: number, b: number): number { ... }",
  response: "The `add` function takes 2 parameter(s): a, b and returns `number`.",
  metadata: {                      // Optional
    source_file: "src/utils.ts",
    entity_name: "add",
    entity_type: "function",
    question_type: "explain_function",
    difficulty: "easy"
  }
}
```

---

## Key Concepts

### Entity vs Example

- **Entity**: A single code structure (1 function, 1 class, etc.)
- **Example**: A single Q&A training pair

**Relationship**: 1 entity → N examples (where N = `questionsPerEntity`, default 5)

Example: 18 functions × 5 questions = 90 training examples

### Template Matching

Templates are filtered by `applicableTo` field:
- Function templates only apply to `'function'` and `'method'` entities
- Class templates only apply to `'class'` entities
- Type templates only apply to `'interface'` and `'type'` entities

### Complexity Calculation

Cyclomatic complexity measures code complexity:
- Base: 1
- +1 for each decision point (if, while, for, switch, catch, ternary)
- +1 for each logical operator (&&, ||)

Higher complexity = more complex code = harder to understand

### Token Estimation

Rough approximation: `tokens = characters / 4`

Used for cost estimation (fine-tuning typically costs ~$0.008 per 1K tokens)

---

## Dependencies

### Runtime Dependencies

- **`commander`**: CLI framework for parsing commands and options
- **`simple-git`**: Git operations (clone, pull)
- **`tree-sitter`**: AST parser (native bindings)
- **`tree-sitter-typescript`**: TypeScript grammar for tree-sitter
- **`@anthropic-ai/sdk`**: (Currently unused - reserved for future AI response generation)

### Dev Dependencies

- **`typescript`**: TypeScript compiler
- **`tsx`**: TypeScript execution (for `pnpm dev`)
- **`@types/node`**: Node.js type definitions

---

## Configuration

### Default Config (`DEFAULT_CONFIG` in `types.ts`)

```typescript
{
  languages: ['typescript', 'javascript'],
  excludePatterns: [
    'node_modules', 'dist', 'build', '.git',
    '*.test.ts', '*.spec.ts', '__tests__',
    '*.d.ts', 'coverage', '.next', '.nuxt', 'vendor'
  ],
  minFunctionLines: 3,
  maxFunctionLines: 200,
  questionsPerEntity: 5,
  includeMetadata: true,
  generateResponses: true,
  format: 'jsonl'
}
```

### CLI Overrides

All defaults can be overridden via CLI flags (see `index.ts` for options).

---

## Error Handling

- **Clone failures**: Catches and provides helpful error messages (404, auth issues)
- **Parse failures**: Silently skips files that fail to parse (continues with other files)
- **Generation failures**: Logs errors but continues processing other entities
- **File write failures**: Throws error and exits

---

## Performance Considerations

- **Shallow clones**: Uses `--depth 1` for faster cloning
- **Caching**: Reuses cloned repos (pulls instead of re-cloning)
- **Async operations**: All file I/O is async/non-blocking
- **Progress updates**: Shows progress bars for long operations
- **Batch processing**: Processes files sequentially (could be parallelized in future)

---

## Future Enhancements (Not Yet Implemented)

- **`extractor.ts`**: Currently empty - could be used for additional extraction logic
- **AI-generated responses**: `@anthropic-ai/sdk` is installed but not used - could generate higher-quality responses using Claude
- **Parallel parsing**: Could parse multiple files concurrently
- **More languages**: Currently only TypeScript/JavaScript - could add Python, Go, etc.
- **Better docstring extraction**: Could improve JSDoc parsing
- **Code embeddings**: Could generate embeddings for semantic search
- **TSX grammar support**: Currently only uses TypeScript grammar - should detect `.tsx` files and use `TypeScript.tsx` grammar for proper JSX parsing
- **Additional templates**: Could add more templates (e.g., `list_dependencies` for classes to ask "What methods does the class have?")
- **Variable and enum extraction**: `EntityType` includes `'variable'` and `'enum'` but parser doesn't extract them yet

---

## Usage Examples

```bash
# Generate training data
pnpm dev generate https://github.com/user/repo -o ./output/data.jsonl

# Generate with train/val/test split
pnpm dev generate https://github.com/user/repo --split

# Preview examples
pnpm dev preview https://github.com/user/repo -n 10

# Analyze existing dataset
pnpm dev stats ./output/data.jsonl
```

---

## Summary

Neocortex is a **code-to-training-data pipeline** that:

1. **Clones** repos using `clone.ts`
2. **Finds** source files using `clone.ts`
3. **Parses** code into entities using `parser.ts` (tree-sitter AST)
4. **Generates** Q&A pairs using `templates.ts` + `generator.ts`
5. **Writes** JSONL files using `output.ts`
6. **Orchestrates** everything via `index.ts` (CLI)

The architecture is **modular** - each file has a single responsibility, making it easy to extend or modify individual components.
