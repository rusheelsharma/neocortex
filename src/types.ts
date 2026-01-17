// ============================================================================
// FILE: src/types.ts
// PURPOSE: Core type definitions for Neocortex training data generator
// ============================================================================

// ----------------------------------------------------------------------------
// SECTION 1.2.1: CODE ENTITY TYPES
// These types represent code structures extracted from the AST
// ----------------------------------------------------------------------------

/**
 * EntityType - Enumeration of all code structures we can extract
 * 
 * The parser identifies these node types in the AST and extracts them.
 * Each type has different properties and generates different questions.
 * 
 * - 'function': Standalone function declarations and arrow functions
 * - 'class': ES6 class declarations
 * - 'method': Methods inside classes (extracted separately for granularity)
 * - 'interface': TypeScript interface declarations
 * - 'type': TypeScript type alias declarations (type X = ...)
 * - 'variable': Exported const/let declarations (future use)
 * - 'enum': TypeScript enum declarations (future use)
 */
export type EntityType =
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'type'
  | 'variable'
  | 'enum';

/**
 * Parameter - Represents a single function/method parameter
 * 
 * Extracted from the AST's parameter nodes. Used to generate
 * questions about function signatures and usage examples.
 * 
 * @property name - The parameter identifier (e.g., "userId")
 * @property type - TypeScript type annotation if present (e.g., "string")
 * @property optional - Whether parameter has ? modifier
 * @property defaultValue - Default value if specified (e.g., "10")
 */
export interface Parameter {
  name: string;
  type: string | null;
  optional: boolean;
  defaultValue: string | null;
}

/**
 * CodeEntity - The core data structure representing an extracted code element
 * 
 * When the parser processes a file, it creates one CodeEntity for each
 * function, class, interface, etc. This is the intermediate representation
 * between raw source code and training examples.
 * 
 * IDENTIFICATION FIELDS:
 * @property id - Unique identifier: "filepath:name:startLine"
 * @property name - The entity's identifier (function name, class name, etc.)
 * @property type - What kind of entity (function, class, interface, etc.)
 * 
 * LOCATION FIELDS:
 * @property file - Relative path to the source file
 * @property startLine - 1-indexed line number where entity starts
 * @property endLine - 1-indexed line number where entity ends
 * 
 * CONTENT FIELDS:
 * @property code - Complete source code of the entity
 * @property signature - Just the declaration line (for functions)
 * @property docstring - JSDoc comment content if present
 * 
 * METRICS FIELDS:
 * @property tokens - Estimated token count (chars / 4)
 * @property complexity - Cyclomatic complexity score
 * 
 * RELATIONSHIP FIELDS:
 * @property calls - Names of functions called within this entity
 * @property parameters - Array of Parameter objects (for functions/methods)
 * @property returnType - TypeScript return type annotation
 * 
 * CLASS-SPECIFIC FIELDS (optional):
 * @property methods - Array of method names (for classes)
 * @property properties - Array of property names (for classes/interfaces)
 */
export interface CodeEntity {
  // Identification
  id: string;
  name: string;
  type: EntityType;

  // Location
  file: string;
  startLine: number;
  endLine: number;

  // Content
  code: string;
  signature: string;
  docstring: string | null;

  // Metrics
  tokens: number;
  complexity: number;

  // Relationships
  calls: string[];
  parameters: Parameter[];
  returnType: string | null;

  // Class-specific (optional)
  methods?: string[];
  properties?: string[];
}

// ----------------------------------------------------------------------------
// SECTION 1.2.2: TRAINING DATA TYPES
// These types represent the output training examples
// ----------------------------------------------------------------------------

/**
 * QuestionType - Categories of questions we generate for each entity
 * 
 * Each CodeEntity can generate multiple training examples using different
 * question types. This creates diversity in the training data.
 * 
 * EASY QUESTIONS (direct extraction):
 * - 'explain_function': "What does X do?"
 * - 'list_parameters': "What are the parameters of X?"
 * - 'explain_return': "What does X return?"
 * - 'list_dependencies': "What functions does X call?"
 * - 'explain_type': "What does this type/interface define?"
 * 
 * MEDIUM QUESTIONS (require synthesis):
 * - 'usage_example': "Show me how to use X"
 * - 'error_handling': "What errors might X throw?"
 * 
 * HARD QUESTIONS (require analysis):
 * - 'suggest_improvement': "How could X be improved?"
 */
export type QuestionType =
  | 'explain_function'
  | 'list_parameters'
  | 'explain_return'
  | 'list_dependencies'
  | 'usage_example'
  | 'error_handling'
  | 'suggest_improvement'
  | 'explain_type';

/**
 * ExampleMetadata - Tracking information attached to each training example
 * 
 * This metadata is useful for:
 * - Filtering datasets (e.g., "only hard questions about functions")
 * - Analyzing coverage (e.g., "how many class examples do we have?")
 * - Debugging (e.g., "which file did this example come from?")
 * - Quality control (e.g., "distribution of difficulties")
 * 
 * @property source_file - Original file path
 * @property entity_name - Name of the function/class/etc
 * @property entity_type - What kind of code entity
 * @property question_type - What category of question
 * @property difficulty - Complexity level of the question
 */
export interface ExampleMetadata {
  source_file: string;
  entity_name: string;
  entity_type: EntityType;
  question_type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
}

/**
 * TrainingExample - A single instruction-tuning training example
 * 
 * This is the OUTPUT format written to the JSONL file. Each line in the
 * output file is one TrainingExample serialized as JSON.
 * 
 * The format follows the standard instruction-tuning schema used by:
 * - OpenAI fine-tuning API
 * - Together.ai
 * - Axolotl
 * - Most open-source fine-tuning frameworks
 * 
 * @property instruction - The question or prompt (user's input)
 * @property context - Code snippet provided as context
 * @property response - The expected answer (assistant's output)
 * @property metadata - Optional tracking information
 * 
 * EXAMPLE:
 * {
 *   "instruction": "What does the `formatDate` function do?",
 *   "context": "// File: src/utils.ts\nfunction formatDate(d: Date): string { ... }",
 *   "response": "The formatDate function takes a Date object and returns...",
 *   "metadata": { "source_file": "src/utils.ts", "entity_name": "formatDate", ... }
 * }
 */
export interface TrainingExample {
  instruction: string;
  context: string;
  response: string;
  metadata?: ExampleMetadata;
}

// ----------------------------------------------------------------------------
// SECTION 1.2.3: CONFIGURATION TYPES
// These types define user-configurable options
// ----------------------------------------------------------------------------

/**
 * GeneratorConfig - All configuration options for the generator
 * 
 * This interface defines every option that can be set via CLI flags
 * or programmatically. The CLI parses arguments and builds this object.
 * 
 * INPUT OPTIONS:
 * @property repoUrl - GitHub repository URL to process
 * @property outputPath - Where to write the JSONL output
 * 
 * PARSING OPTIONS:
 * @property languages - File extensions to process (default: ts, tsx, js, jsx)
 * @property excludePatterns - Glob patterns to skip (default: node_modules, etc.)
 * @property minFunctionLines - Skip functions shorter than this (default: 3)
 * @property maxFunctionLines - Skip functions longer than this (default: 200)
 * 
 * GENERATION OPTIONS:
 * @property questionsPerEntity - How many Q&A pairs per function (default: 5)
 * @property includeMetadata - Add metadata to output (default: true)
 * @property generateResponses - Generate AI responses (default: true)
 * 
 * OUTPUT OPTIONS:
 * @property format - Output format: jsonl, json, or parquet (default: jsonl)
 * @property splitRatio - Optional train/val/test split ratios
 */
export interface GeneratorConfig {
  // Input
  repoUrl: string;
  outputPath: string;

  // Parsing
  languages: string[];
  excludePatterns: string[];
  minFunctionLines: number;
  maxFunctionLines: number;

  // Generation
  questionsPerEntity: number;
  includeMetadata: boolean;
  generateResponses: boolean;

  // Output
  format: 'jsonl' | 'json' | 'parquet';
  splitRatio?: {
    train: number;
    val: number;
    test: number;
  };
}

/**
 * DEFAULT_CONFIG - Sensible defaults for all configuration options
 * 
 * These defaults are merged with user-provided options. Users only need
 * to specify the options they want to override.
 * 
 * Partial means not all fields are required - repoUrl
 * and outputPath must be provided by the user.
 */
export const DEFAULT_CONFIG: Partial<GeneratorConfig> = {
  // Parse TypeScript and JavaScript files
  languages: ['typescript', 'javascript'],

  // Skip these directories and file patterns
  excludePatterns: [
    'node_modules',      // Dependencies
    'dist',              // Build output
    'build',             // Build output
    '.git',              // Git internals
    '*.test.ts',         // Test files
    '*.spec.ts',         // Test files
    '__tests__',         // Test directories
    '*.d.ts',            // Type declaration files
    'coverage',          // Test coverage
    '.next',             // Next.js build
    '.nuxt',             // Nuxt build
    'vendor',            // Vendored dependencies
  ],

  // Function size limits
  minFunctionLines: 3,   // Skip one-liners
  maxFunctionLines: 200, // Skip massive functions

  // Generation settings
  questionsPerEntity: 5,
  includeMetadata: true,
  generateResponses: true,

  // Output format
  format: 'jsonl',
};

// ----------------------------------------------------------------------------
// SECTION 1.2.4: STATISTICS TYPES
// These types track generation metrics
// ----------------------------------------------------------------------------

/**
 * GenerationStats - Summary statistics for a generation run
 * 
 * Displayed at the end of generation and saved to a -stats.json file.
 * Useful for understanding what was generated and estimating costs.
 * 
 * @property repoName - Name of the processed repository
 * @property filesProcessed - Number of source files parsed
 * @property entitiesFound - Breakdown by entity type
 * @property examplesGenerated - Total training examples created
 * @property totalTokens - Estimated total tokens in output
 * @property estimatedCost - Approximate fine-tuning cost (USD)
 * @property processingTimeMs - How long generation took
 */
export interface GenerationStats {
  repoName: string;
  filesProcessed: number;
  entitiesFound: {
    functions: number;
    classes: number;
    methods: number;
    interfaces: number;
    types: number;
    total: number;
  };
  examplesGenerated: number;
  totalTokens: number;
  estimatedCost: number;
  processingTimeMs: number;
}

// ----------------------------------------------------------------------------
// SECTION 1.2.5: UTILITY TYPES (for future extensibility)
// ----------------------------------------------------------------------------

/**
 * ParseResult - Result of parsing a single file
 * Used internally by the parser module
 */
export interface ParseResult {
  filePath: string;
  entities: CodeEntity[];
  errors: string[];
}

/**
 * GenerationResult - Result of the full generation pipeline
 * Used for programmatic API access
 */
export interface GenerationResult {
  examples: TrainingExample[];
  stats: GenerationStats;
  errors: string[];
}
