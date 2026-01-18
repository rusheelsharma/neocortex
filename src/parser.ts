// ============================================================================
// FILE: src/parser.ts
// PURPOSE: AST parsing using tree-sitter to extract code entities
// ============================================================================

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import * as fs from 'fs/promises';
import { CodeEntity, Parameter } from './types.js';

// Type assertion needed due to tree-sitter-typescript typing issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TypeScriptLanguage = TypeScript.typescript as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TSXLanguage = TypeScript.tsx as any;

// ----------------------------------------------------------------------------
// SECTION 3.2.1: PARSER INITIALIZATION
// ----------------------------------------------------------------------------

/**
 * Initialize the tree-sitter parser with TypeScript language support
 * 
 * tree-sitter is a parsing library that generates ASTs. It's:
 * - Fast: Parses files in milliseconds
 * - Incremental: Can update parse trees efficiently
 * - Error-tolerant: Produces useful trees even for invalid code
 * 
 * The parser supports both TypeScript (.ts) and TSX (.tsx) files.
 * The language is set per-file based on file extension.
 */
const parser = new Parser();

// ----------------------------------------------------------------------------
// SECTION 3.2.2: MAIN PARSE FUNCTION
// ----------------------------------------------------------------------------

/**
 * parseFile - Parse a single source file and extract all code entities
 * 
 * This is the main entry point for parsing. It:
 * 1. Reads the file content
 * 2. Parses into AST
 * 3. Walks the tree extracting entities
 * 4. Returns array of CodeEntity objects
 * 
 * @param filePath - Absolute path to the source file
 * @returns Array of CodeEntity objects found in the file
 * 
 * EXAMPLE:
 * const entities = await parseFile('/path/to/button.tsx');
 * // Returns: [{ name: 'Button', type: 'function', ... }, ...]
 */
export async function parseFile(filePath: string): Promise<CodeEntity[]> {
  // Read file content
  const content = await fs.readFile(filePath, 'utf-8');

  // Switch grammar based on file extension
  // TSX/JSX files need the TSX grammar to handle JSX syntax
  if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
    parser.setLanguage(TSXLanguage);
  } else {
    parser.setLanguage(TypeScriptLanguage);
  }

  // Parse into AST
  // tree-sitter is synchronous - parsing is very fast
  const tree = parser.parse(content);

  // Collect entities from the AST
  const entities: CodeEntity[] = [];

  // Walk the entire tree, examining each node
  walkNode(tree.rootNode, (node) => {
    // Try to extract an entity from this node
    const entity = extractEntity(node, filePath, content);
    if (entity) {
      entities.push(entity);
    }
  });

  return entities;
}

// ----------------------------------------------------------------------------
// SECTION 3.2.3: AST WALKING
// ----------------------------------------------------------------------------

/**
 * walkNode - Recursively walk all nodes in the AST
 * 
 * This is a depth-first traversal that visits every node in the tree.
 * The callback is called for each node, allowing us to inspect it.
 * 
 * @param node - Current AST node
 * @param callback - Function to call for each node
 * 
 * AST STRUCTURE:
 * Each node has:
 * - type: string identifying the node type (e.g., 'function_declaration')
 * - text: the source code text this node represents
 * - children: array of child nodes
 * - startPosition/endPosition: location in source
 * - childForFieldName(): get specific named children
 */
function walkNode(
  node: Parser.SyntaxNode,
  callback: (node: Parser.SyntaxNode) => void
): void {
  // Call the callback for this node
  callback(node);

  // Recursively walk all children
  for (const child of node.children) {
    walkNode(child, callback);
  }
}

// ----------------------------------------------------------------------------
// SECTION 3.2.4: ENTITY EXTRACTION DISPATCHER
// ----------------------------------------------------------------------------

/**
 * extractEntity - Attempt to extract a CodeEntity from an AST node
 * 
 * This is the dispatcher that checks the node type and calls the
 * appropriate extraction function. Only certain node types produce
 * entities - most nodes are just structural.
 * 
 * @param node - AST node to examine
 * @param filePath - Path to source file (for entity ID)
 * @param content - Full file content (for extracting code text)
 * @returns CodeEntity if this node is extractable, null otherwise
 * 
 * SUPPORTED NODE TYPES:
 * - function_declaration: Regular function
 * - arrow_function: Arrow function (const x = () => {})
 * - function_expression: Function expression (const x = function() {})
 * - class_declaration: ES6 class
 * - interface_declaration: TypeScript interface
 * - type_alias_declaration: TypeScript type alias
 * - method_definition: Method inside a class
 */
function extractEntity(
  node: Parser.SyntaxNode,
  filePath: string,
  content: string
): CodeEntity | null {
  switch (node.type) {
    // Functions
    case 'function_declaration':
    case 'arrow_function':
    case 'function_expression':
      return extractFunction(node, filePath, content);

    // Classes
    case 'class_declaration':
      return extractClass(node, filePath, content);

    // TypeScript-specific
    case 'interface_declaration':
      return extractInterface(node, filePath, content);

    case 'type_alias_declaration':
      return extractTypeAlias(node, filePath, content);

    // Methods (inside classes)
    case 'method_definition':
      return extractMethod(node, filePath, content);

    // Variables (const, let, var)
    case 'lexical_declaration':
    case 'variable_declaration':
      return extractVariable(node, filePath, content);

    // All other node types - not entities we extract
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// SECTION 3.2.5: FUNCTION EXTRACTION
// ----------------------------------------------------------------------------

/**
 * extractFunction - Extract a function entity from an AST node
 * 
 * Handles three cases:
 * 1. function_declaration: function foo() {}
 * 2. arrow_function: const foo = () => {}
 * 3. function_expression: const foo = function() {}
 * 
 * For arrow functions and function expressions, we need to look at the
 * parent node to find the variable name.
 * 
 * @param node - Function AST node
 * @param filePath - Source file path
 * @param content - Full file content
 * @returns CodeEntity for the function, or null if unnamed
 */
function extractFunction(
  node: Parser.SyntaxNode,
  filePath: string,
  content: string
): CodeEntity | null {
  // Try to get the function name directly
  const nameNode = node.childForFieldName('name');

  if (nameNode) {
    // Named function declaration: function foo() {}
    return extractFunctionWithName(node, nameNode.text, filePath, content);
  }

  // Arrow function or function expression - name is in parent
  // Look for pattern: const foo = () => {} or const foo = function() {}
  const parent = node.parent;

  if (parent?.type === 'variable_declarator') {
    // Parent is: foo = () => {}
    // Get the variable name
    const varNameNode = parent.childForFieldName('name');
    if (varNameNode) {
      return extractFunctionWithName(node, varNameNode.text, filePath, content);
    }
  }

  // Anonymous function with no name - skip it
  // These are usually callbacks: array.map(x => x * 2)
  return null;
}

/**
 * extractFunctionWithName - Extract function details given its name
 * 
 * This does the heavy lifting of extracting all function metadata.
 * 
 * @param node - Function AST node
 * @param name - Function name (already extracted)
 * @param filePath - Source file path
 * @param content - Full file content
 * @returns Complete CodeEntity for the function
 */
function extractFunctionWithName(
  node: Parser.SyntaxNode,
  name: string,
  filePath: string,
  content: string
): CodeEntity {
  // Get location (1-indexed for human readability)
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;

  // Extract the full source code
  const code = content.substring(node.startIndex, node.endIndex);

  // Look for JSDoc comment above the function
  const docstring = extractDocstring(node, content);

  // Extract parameters
  const paramsNode = node.childForFieldName('parameters');
  const parameters = paramsNode ? extractParameters(paramsNode) : [];

  // Extract return type annotation
  const returnTypeNode = node.childForFieldName('return_type');
  const returnType = returnTypeNode 
    ? returnTypeNode.text.replace(/^:\s*/, '') // Remove leading ": "
    : null;

  // Find all function calls within this function
  const calls = extractFunctionCalls(node);

  // Calculate cyclomatic complexity
  const complexity = calculateComplexity(node);

  // Build the signature string
  const signature = buildSignature(name, parameters, returnType);

  return {
    id: `${filePath}:${name}:${startLine}`,
    name,
    type: 'function',
    file: filePath,
    startLine,
    endLine,
    code,
    signature,
    docstring,
    tokens: estimateTokens(code),
    complexity,
    calls,
    parameters,
    returnType,
  };
}

// ----------------------------------------------------------------------------
// SECTION 3.2.6: CLASS EXTRACTION
// ----------------------------------------------------------------------------

/**
 * extractClass - Extract a class entity from an AST node
 * 
 * Classes have:
 * - A name
 * - Methods (which we also extract separately)
 * - Properties
 * - Possibly a constructor
 * - Possibly extends/implements clauses
 * 
 * @param node - Class declaration AST node
 * @param filePath - Source file path
 * @param content - Full file content
 * @returns CodeEntity for the class, or null if unnamed
 */
function extractClass(
  node: Parser.SyntaxNode,
  filePath: string,
  content: string
): CodeEntity | null {
  // Get class name
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return null; // Anonymous class - rare but possible

  const name = nameNode.text;
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  const code = content.substring(node.startIndex, node.endIndex);
  const docstring = extractDocstring(node, content);

  // Extract method and property names
  const methods: string[] = [];
  const properties: string[] = [];

  // Get the class body
  const bodyNode = node.childForFieldName('body');
  if (bodyNode) {
    for (const child of bodyNode.children) {
      if (child.type === 'method_definition') {
        // Regular method
        const methodName = child.childForFieldName('name');
        if (methodName) methods.push(methodName.text);
      } else if (
        child.type === 'public_field_definition' ||
        child.type === 'field_definition'
      ) {
        // Class property
        const propName = child.childForFieldName('name');
        if (propName) properties.push(propName.text);
      }
    }
  }

  return {
    id: `${filePath}:${name}:${startLine}`,
    name,
    type: 'class',
    file: filePath,
    startLine,
    endLine,
    code,
    signature: `class ${name}`,
    docstring,
    tokens: estimateTokens(code),
    complexity: calculateComplexity(node),
    calls: [], // Classes don't directly call functions
    parameters: [], // Classes don't have parameters
    returnType: null,
    methods,
    properties,
  };
}

// ----------------------------------------------------------------------------
// SECTION 3.2.7: INTERFACE EXTRACTION
// ----------------------------------------------------------------------------

/**
 * extractInterface - Extract a TypeScript interface entity
 * 
 * Interfaces define the shape of objects. We extract:
 * - The interface name
 * - All property names
 * - JSDoc comments
 * 
 * @param node - Interface declaration AST node
 * @param filePath - Source file path
 * @param content - Full file content
 * @returns CodeEntity for the interface, or null if unnamed
 */
function extractInterface(
  node: Parser.SyntaxNode,
  filePath: string,
  content: string
): CodeEntity | null {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return null;

  const name = nameNode.text;
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  const code = content.substring(node.startIndex, node.endIndex);
  const docstring = extractDocstring(node, content);

  // Extract property names from the interface body
  const properties: string[] = [];
  const bodyNode = node.childForFieldName('body');

  if (bodyNode) {
    for (const child of bodyNode.children) {
      if (child.type === 'property_signature') {
        const propName = child.childForFieldName('name');
        if (propName) properties.push(propName.text);
      } else if (child.type === 'method_signature') {
        // Interface can also have method signatures
        const methodName = child.childForFieldName('name');
        if (methodName) properties.push(methodName.text + '()');
      }
    }
  }

  return {
    id: `${filePath}:${name}:${startLine}`,
    name,
    type: 'interface',
    file: filePath,
    startLine,
    endLine,
    code,
    signature: `interface ${name}`,
    docstring,
    tokens: estimateTokens(code),
    complexity: 1, // Interfaces have no control flow
    calls: [],
    parameters: [],
    returnType: null,
    properties,
  };
}

// ----------------------------------------------------------------------------
// SECTION 3.2.8: TYPE ALIAS EXTRACTION
// ----------------------------------------------------------------------------

/**
 * extractTypeAlias - Extract a TypeScript type alias entity
 * 
 * Type aliases are like: type UserId = string | number
 * 
 * @param node - Type alias declaration AST node
 * @param filePath - Source file path
 * @param content - Full file content
 * @returns CodeEntity for the type alias, or null if unnamed
 */
function extractTypeAlias(
  node: Parser.SyntaxNode,
  filePath: string,
  content: string
): CodeEntity | null {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return null;

  const name = nameNode.text;
  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  const code = content.substring(node.startIndex, node.endIndex);

  return {
    id: `${filePath}:${name}:${startLine}`,
    name,
    type: 'type',
    file: filePath,
    startLine,
    endLine,
    code,
    signature: `type ${name}`,
    docstring: extractDocstring(node, content),
    tokens: estimateTokens(code),
    complexity: 1,
    calls: [],
    parameters: [],
    returnType: null,
  };
}

// ----------------------------------------------------------------------------
// SECTION 3.2.9: METHOD EXTRACTION
// ----------------------------------------------------------------------------

/**
 * extractMethod - Extract a method from inside a class
 * 
 * Methods are extracted separately from their parent class for
 * more granular training data. The method name includes the
 * class name for context: "ClassName.methodName"
 * 
 * @param node - Method definition AST node
 * @param filePath - Source file path
 * @param content - Full file content
 * @returns CodeEntity for the method, or null if unnamed
 */
function extractMethod(
  node: Parser.SyntaxNode,
  filePath: string,
  content: string
): CodeEntity | null {
  const nameNode = node.childForFieldName('name');
  if (!nameNode) return null;

  // Find the parent class name
  let className = 'Unknown';
  let parent = node.parent;

  while (parent) {
    if (parent.type === 'class_declaration') {
      const classNameNode = parent.childForFieldName('name');
      if (classNameNode) {
        className = classNameNode.text;
      }
      break;
    }
    parent = parent.parent;
  }

  // Combine class and method name
  const methodName = nameNode.text;
  const fullName = `${className}.${methodName}`;

  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  const code = content.substring(node.startIndex, node.endIndex);

  // Extract parameters
  const paramsNode = node.childForFieldName('parameters');
  const parameters = paramsNode ? extractParameters(paramsNode) : [];

  // Extract return type
  const returnTypeNode = node.childForFieldName('return_type');
  const returnType = returnTypeNode
    ? returnTypeNode.text.replace(/^:\s*/, '')
    : null;

  return {
    id: `${filePath}:${fullName}:${startLine}`,
    name: fullName,
    type: 'method',
    file: filePath,
    startLine,
    endLine,
    code,
    signature: buildSignature(methodName, parameters, returnType),
    docstring: extractDocstring(node, content),
    tokens: estimateTokens(code),
    complexity: calculateComplexity(node),
    calls: extractFunctionCalls(node),
    parameters,
    returnType,
  };
}

// ----------------------------------------------------------------------------
// SECTION 3.2.10: VARIABLE EXTRACTION
// ----------------------------------------------------------------------------

/**
 * extractVariable - Extract a variable declaration (const, let, var)
 * 
 * Extracts:
 * - Module-level variables (const API_URL = "...")
 * - React hooks (useState, useRef, useMemo, useCallback, useContext)
 * - Important patterns (useRef, createClient, express(), etc.)
 * 
 * Skips:
 * - Loop variables (for (const i = 0; ...))
 * - Simple local variables inside functions (unless React hooks)
 * - Function expressions (handled by extractFunction)
 * 
 * @param node - Variable declaration AST node
 * @param filePath - Source file path
 * @param content - Full file content
 * @returns CodeEntity for the variable, or null if should be skipped
 */
function extractVariable(
  node: Parser.SyntaxNode,
  filePath: string,
  content: string
): CodeEntity | null {
  // Get the declarator (contains name and value)
  const declarator = node.children.find(
    (child) => child.type === 'variable_declarator'
  );
  if (!declarator) return null;

  // Get variable name
  const nameNode = declarator.childForFieldName('name');
  if (!nameNode) return null;

  const name = nameNode.text;

  // Get the value/initializer
  const valueNode = declarator.childForFieldName('value');
  
  // Skip if it's a function/arrow function (handled by extractFunction)
  if (valueNode) {
    if (
      valueNode.type === 'arrow_function' ||
      valueNode.type === 'function_expression' ||
      valueNode.type === 'function'
    ) {
      return null; // This is a function, not a variable
    }
  }

  const valueText = valueNode?.text || '';

  // Check if inside a function
  let isInsideFunction = false;
  let parent = node.parent;
  while (parent) {
    if (
      parent.type === 'function_declaration' ||
      parent.type === 'arrow_function' ||
      parent.type === 'function_expression' ||
      parent.type === 'method_definition'
    ) {
      isInsideFunction = true;
      break;
    }
    parent = parent.parent;
  }

  // If inside a function, only extract React hooks and important patterns
  if (isInsideFunction) {
    const isReactHook = 
      valueText.includes('useState(') ||
      valueText.includes('useRef(') ||
      valueText.includes('useMemo(') ||
      valueText.includes('useCallback(') ||
      valueText.includes('useContext(') ||
      valueText.includes('useReducer(') ||
      valueText.includes('useEffect') ||
      valueText.includes('useLayoutEffect');
    
    const isImportantPattern =
      valueText.includes('createClient(') ||
      valueText.includes('createContext(') ||
      valueText.includes('createStore(') ||
      valueText.includes('express(') ||
      valueText.includes('Router(');

    // Skip non-important variables inside functions
    if (!isReactHook && !isImportantPattern) {
      return null;
    }
  }

  // Skip loop variables
  const parentType = node.parent?.type;
  if (
    parentType === 'for_statement' ||
    parentType === 'for_in_statement' ||
    parentType === 'for_of_statement'
  ) {
    return null;
  }

  // Get the declaration keyword (const, let, var)
  const keyword = node.children.find(
    (child) => child.text === 'const' || child.text === 'let' || child.text === 'var'
  );
  const declarationType = keyword?.text || 'const';

  const startLine = node.startPosition.row + 1;
  const endLine = node.endPosition.row + 1;
  const code = content.substring(node.startIndex, node.endIndex);
  const docstring = extractDocstring(node, content);

  // Get type annotation if present
  const typeNode = declarator.childForFieldName('type');
  const varType = typeNode ? typeNode.text.replace(/^:\s*/, '') : null;

  // Build signature
  let signature = `${declarationType} ${name}`;
  if (varType) {
    signature += `: ${varType}`;
  }

  return {
    id: `${filePath}:${name}:${startLine}`,
    name,
    type: 'variable',
    file: filePath,
    startLine,
    endLine,
    code,
    signature,
    docstring,
    tokens: estimateTokens(code),
    complexity: 1, // Variables have no control flow
    calls: [], // Variables don't call functions directly
    parameters: [],
    returnType: varType, // Reuse returnType field for variable type
    properties: valueText ? [valueText.slice(0, 100)] : [], // Store truncated initial value
  };
}

// ----------------------------------------------------------------------------
// SECTION 3.2.11: HELPER FUNCTIONS - DOCSTRINGS
// ----------------------------------------------------------------------------

/**
 * extractDocstring - Extract JSDoc comment preceding a node
 * 
 * Looks backwards from the node's position to find comments.
 * Handles both JSDoc (/** ... *\/) and single-line (// ...) comments.
 * 
 * @param node - AST node to find docstring for
 * @param content - Full file content
 * @returns Cleaned docstring text, or null if none found
 * 
 * EXAMPLE INPUT:
 * /**
 *  * Adds two numbers together
 *  * @param a First number
 *  * @param b Second number
 *  *\/
 * function add(a, b) { ... }
 * 
 * EXAMPLE OUTPUT:
 * "Adds two numbers together\n@param a First number\n@param b Second number"
 */
function extractDocstring(
  node: Parser.SyntaxNode,
  content: string
): string | null {
  // Get all content before this node
  const beforeNode = content.substring(0, node.startIndex);

  // Split into lines and work backwards
  const lines = beforeNode.split('\n');
  const relevantLines: string[] = [];

  // Walk backwards through lines looking for comments
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();

    // Skip empty lines at the end
    if (line === '' && relevantLines.length === 0) continue;

    // End of JSDoc block
    if (line.endsWith('*/')) {
      relevantLines.unshift(line);
      continue;
    }

    // Middle or start of JSDoc
    if (line.startsWith('*') || line.startsWith('/**')) {
      relevantLines.unshift(line);
      // If this is the start, we're done
      if (line.startsWith('/**')) break;
      continue;
    }

    // Single-line comment
    if (line.startsWith('//')) {
      relevantLines.unshift(line);
      continue;
    }

    // Hit non-comment content - stop
    break;
  }

  if (relevantLines.length === 0) return null;

  // Clean up the docstring
  const cleaned = relevantLines
    .map((line) =>
      line
        .replace(/^\/\*\*\s?/, '')  // Remove /** at start
        .replace(/\*\/\s?$/, '')     // Remove */ at end
        .replace(/^\s*\*\s?/, '')    // Remove * at line start
        .replace(/^\/\/\s?/, '')     // Remove // at start
    )
    .filter((line) => line.trim() !== '') // Remove empty lines
    .join('\n')
    .trim();

  return cleaned || null;
}

// ----------------------------------------------------------------------------
// SECTION 3.2.11: HELPER FUNCTIONS - PARAMETERS
// ----------------------------------------------------------------------------

/**
 * extractParameters - Extract parameter information from a parameters node
 * 
 * Parameters node contains all function parameters. Each can be:
 * - required_parameter: Regular parameter
 * - optional_parameter: Has ? modifier
 * - rest_parameter: Has ... spread operator
 * 
 * @param paramsNode - AST node for the parameters list
 * @returns Array of Parameter objects
 */
function extractParameters(paramsNode: Parser.SyntaxNode): Parameter[] {
  const params: Parameter[] = [];

  for (const child of paramsNode.children) {
    // Skip punctuation nodes (commas, parentheses)
    if (
      child.type === 'required_parameter' ||
      child.type === 'optional_parameter' ||
      child.type === 'rest_parameter'
    ) {
      // Get parameter name
      // For destructuring patterns, this gets the pattern
      const nameNode =
        child.childForFieldName('pattern') ||
        child.childForFieldName('name');

      // Get type annotation
      const typeNode = child.childForFieldName('type');

      // Get default value (for optional params)
      const valueNode = child.childForFieldName('value');

      params.push({
        name: nameNode?.text || 'unknown',
        type: typeNode ? typeNode.text.replace(/^:\s*/, '') : null,
        optional: child.type === 'optional_parameter',
        defaultValue: valueNode?.text || null,
      });
    }
  }

  return params;
}

// ----------------------------------------------------------------------------
// SECTION 3.2.12: HELPER FUNCTIONS - FUNCTION CALLS
// ----------------------------------------------------------------------------

/**
 * extractFunctionCalls - Find all function calls within a node
 * 
 * Walks the AST looking for call_expression nodes. Extracts the
 * function name being called. Handles:
 * - Simple calls: foo()
 * - Method calls: obj.foo() -> extracts "foo"
 * - Optional chaining: obj?.foo() -> extracts "foo"
 * 
 * @param node - AST node to search within
 * @returns Array of unique function names called
 */
function extractFunctionCalls(node: Parser.SyntaxNode): string[] {
  const calls: string[] = [];

  walkNode(node, (n) => {
    if (n.type === 'call_expression') {
      // Get the function being called
      const funcNode = n.childForFieldName('function');

      if (funcNode) {
        let name = funcNode.text;

        // For member expressions (obj.method), extract just the method name
        // This keeps calls cleaner: ["method"] instead of ["obj.method"]
        if (name.includes('.')) {
          name = name.split('.').pop() || name;
        }

        // Handle optional chaining
        if (name.includes('?.')) {
          name = name.split('?.').pop() || name;
        }

        // Add to list if not already present
        if (name && !calls.includes(name)) {
          calls.push(name);
        }
      }
    }
  });

  return calls;
}

// ----------------------------------------------------------------------------
// SECTION 3.2.13: HELPER FUNCTIONS - COMPLEXITY
// ----------------------------------------------------------------------------

/**
 * calculateComplexity - Calculate cyclomatic complexity of a node
 * 
 * Cyclomatic complexity measures the number of linearly independent
 * paths through code. Higher = more complex = harder to understand.
 * 
 * We count:
 * - Each decision point (if, while, for, switch case, catch)
 * - Each logical operator (&& and ||)
 * - Base complexity of 1
 * 
 * @param node - AST node to analyze
 * @returns Cyclomatic complexity score (1 = simplest)
 * 
 * EXAMPLE:
 * function simple() { return 1; }  // Complexity: 1
 * function withIf(x) { if (x) return 1; return 0; }  // Complexity: 2
 * function complex(x, y) { if (x && y) return 1; else if (x) return 2; return 0; }  // Complexity: 4
 */
function calculateComplexity(node: Parser.SyntaxNode): number {
  let complexity = 1; // Base complexity

  walkNode(node, (n) => {
    // Decision points that add complexity
    const decisionPoints = [
      'if_statement',
      'while_statement',
      'for_statement',
      'for_in_statement',
      'for_of_statement',
      'switch_case',
      'catch_clause',
      'ternary_expression',
      'conditional_expression',
    ];

    if (decisionPoints.includes(n.type)) {
      complexity++;
    }

    // Logical operators also add complexity
    if (n.type === 'binary_expression') {
      const operator = n.childForFieldName('operator');
      if (operator && (operator.text === '&&' || operator.text === '||')) {
        complexity++;
      }
    }
  });

  return complexity;
}

// ----------------------------------------------------------------------------
// SECTION 3.2.14: HELPER FUNCTIONS - UTILITIES
// ----------------------------------------------------------------------------

/**
 * buildSignature - Build a human-readable function signature
 * 
 * @param name - Function name
 * @param params - Array of parameters
 * @param returnType - Return type annotation
 * @returns Signature string like "foo(a: string, b?: number): boolean"
 */
function buildSignature(
  name: string,
  params: Parameter[],
  returnType: string | null
): string {
  const paramStr = params
    .map((p) => {
      let s = p.name;
      if (p.optional) s += '?';
      if (p.type) s += `: ${p.type}`;
      if (p.defaultValue) s += ` = ${p.defaultValue}`;
      return s;
    })
    .join(', ');

  let sig = `${name}(${paramStr})`;
  if (returnType) {
    sig += `: ${returnType}`;
  }

  return sig;
}

/**
 * estimateTokens - Estimate the token count for a piece of code
 * 
 * Most tokenizers average about 4 characters per token for code.
 * This is a rough estimate used for cost calculations.
 * 
 * @param code - Source code text
 * @returns Estimated token count
 */
function estimateTokens(code: string): number {
  return Math.ceil(code.length / 4);
}
