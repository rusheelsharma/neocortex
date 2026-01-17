// ============================================================================
// FILE: src/templates.ts
// PURPOSE: Question templates that convert CodeEntity -> TrainingExample
// ============================================================================

import { CodeEntity, QuestionType } from './types.js';

/**
 * QuestionTemplate - Defines how to generate a specific type of question
 * 
 * Each template specifies:
 * - type: The category of question
 * - difficulty: How hard the question is
 * - applicableTo: Which entity types this template works for
 * - instruction: Function to generate the question text
 * - generateResponse: Function to generate the answer
 */
export interface QuestionTemplate {
  type: QuestionType;
  difficulty: 'easy' | 'medium' | 'hard';
  applicableTo: ('function' | 'class' | 'interface' | 'type' | 'method')[];
  instruction: (entity: CodeEntity) => string;
  generateResponse: (entity: CodeEntity) => string;
}

/**
 * TEMPLATES - All question templates used for generating training data
 */
export const TEMPLATES: QuestionTemplate[] = [
  // -------------------------------------------------------------------------
  // EASY: Explain function
  // -------------------------------------------------------------------------
  {
    type: 'explain_function',
    difficulty: 'easy',
    applicableTo: ['function', 'method'],
    instruction: (e) => `What does the \`${e.name}\` function do?`,
    generateResponse: (e) => {
      if (e.docstring) return e.docstring;
      const parts = [`The \`${e.name}\` function`];
      if (e.parameters.length > 0) {
        parts.push(`takes ${e.parameters.length} parameter(s): ${e.parameters.map(p => p.name).join(', ')}`);
      }
      if (e.returnType) parts.push(`and returns \`${e.returnType}\``);
      if (e.calls.length > 0) parts.push(`It calls: ${e.calls.slice(0, 5).join(', ')}`);
      return parts.join('. ') + '.';
    }
  },

  // -------------------------------------------------------------------------
  // EASY: List parameters
  // -------------------------------------------------------------------------
  {
    type: 'list_parameters',
    difficulty: 'easy',
    applicableTo: ['function', 'method'],
    instruction: (e) => `What are the parameters of \`${e.name}\`?`,
    generateResponse: (e) => {
      if (e.parameters.length === 0) return `\`${e.name}\` takes no parameters.`;
      const params = e.parameters.map(p => {
        let desc = `- \`${p.name}\``;
        if (p.type) desc += ` (${p.type})`;
        if (p.optional) desc += ' - optional';
        return desc;
      });
      return `Parameters:\n${params.join('\n')}`;
    }
  },

  // -------------------------------------------------------------------------
  // EASY: Return type
  // -------------------------------------------------------------------------
  {
    type: 'explain_return',
    difficulty: 'easy',
    applicableTo: ['function', 'method'],
    instruction: (e) => `What does \`${e.name}\` return?`,
    generateResponse: (e) => {
      if (!e.returnType || e.returnType === 'void') return `\`${e.name}\` returns nothing (void).`;
      return `\`${e.name}\` returns \`${e.returnType}\`.`;
    }
  },

  // -------------------------------------------------------------------------
  // EASY: Dependencies
  // -------------------------------------------------------------------------
  {
    type: 'list_dependencies',
    difficulty: 'easy',
    applicableTo: ['function', 'method'],
    instruction: (e) => `What functions does \`${e.name}\` call?`,
    generateResponse: (e) => {
      if (e.calls.length === 0) return `\`${e.name}\` doesn't call other functions.`;
      return `\`${e.name}\` calls: ${e.calls.join(', ')}.`;
    }
  },

  // -------------------------------------------------------------------------
  // MEDIUM: Usage example
  // -------------------------------------------------------------------------
  {
    type: 'usage_example',
    difficulty: 'medium',
    applicableTo: ['function', 'method'],
    instruction: (e) => `Show an example of using \`${e.name}\`.`,
    generateResponse: (e) => {
      const args = e.parameters.map(p => {
        if (p.type?.includes('string')) return '"example"';
        if (p.type?.includes('number')) return '42';
        if (p.type?.includes('boolean')) return 'true';
        if (p.type?.includes('[]')) return '[]';
        return `/* ${p.name} */`;
      });
      
      // Handle methods - need to instantiate the class first
      if (e.type === 'method' && e.name.includes('.')) {
        const [className, methodName] = e.name.split('.');
        const call = e.returnType && e.returnType !== 'void'
          ? `const instance = new ${className}();\nconst result = instance.${methodName}(${args.join(', ')});`
          : `const instance = new ${className}();\ninstance.${methodName}(${args.join(', ')});`;
        return `\`\`\`typescript\n${call}\n\`\`\``;
      }
      
      // Regular functions
      const call = e.returnType && e.returnType !== 'void'
        ? `const result = ${e.name}(${args.join(', ')});`
        : `${e.name}(${args.join(', ')});`;
      return `\`\`\`typescript\n${call}\n\`\`\``;
    }
  },

  // -------------------------------------------------------------------------
  // MEDIUM: Error handling
  // -------------------------------------------------------------------------
  {
    type: 'error_handling',
    difficulty: 'medium',
    applicableTo: ['function', 'method'],
    instruction: (e) => `What errors might \`${e.name}\` throw?`,
    generateResponse: (e) => {
      const hasThrow = e.code.includes('throw ');
      const hasTry = e.code.includes('try {');
      if (!hasThrow && !hasTry) return `\`${e.name}\` has no explicit error handling.`;
      const matches = e.code.match(/throw\s+new\s+(\w+)/g);
      if (matches) {
        const errors = matches.map(m => m.replace(/throw\s+new\s+/, ''));
        return `\`${e.name}\` may throw: ${errors.join(', ')}.`;
      }
      return `\`${e.name}\` includes try-catch error handling.`;
    }
  },

  // -------------------------------------------------------------------------
  // HARD: Suggest improvements
  // -------------------------------------------------------------------------
  {
    type: 'suggest_improvement',
    difficulty: 'hard',
    applicableTo: ['function', 'method'],
    instruction: (e) => `How could \`${e.name}\` be improved?`,
    generateResponse: (e) => {
      const suggestions: string[] = [];
      if (e.complexity > 10) suggestions.push('Reduce complexity - break into smaller functions');
      if (e.endLine - e.startLine > 50) suggestions.push('Function is long - consider extracting helpers');
      if (!e.docstring) suggestions.push('Add JSDoc documentation');
      if (e.parameters.length > 4) suggestions.push('Too many params - use options object');
      if (!e.returnType) suggestions.push('Add explicit return type');
      if (suggestions.length === 0) return `\`${e.name}\` is well-structured.`;
      return `Suggestions:\n${suggestions.map(s => `- ${s}`).join('\n')}`;
    }
  },

  // -------------------------------------------------------------------------
  // CLASS: Explain
  // -------------------------------------------------------------------------
  {
    type: 'explain_function',
    difficulty: 'easy',
    applicableTo: ['class'],
    instruction: (e) => `What is the \`${e.name}\` class?`,
    generateResponse: (e) => {
      if (e.docstring) return e.docstring;
      const parts = [`\`${e.name}\` class`];
      if (e.methods?.length) parts.push(`has methods: ${e.methods.slice(0, 5).join(', ')}`);
      if (e.properties?.length) parts.push(`has properties: ${e.properties.slice(0, 5).join(', ')}`);
      return parts.join(', ') + '.';
    }
  },

  // -------------------------------------------------------------------------
  // INTERFACE/TYPE: Explain
  // -------------------------------------------------------------------------
  {
    type: 'explain_type',
    difficulty: 'easy',
    applicableTo: ['interface', 'type'],
    instruction: (e) => `What does \`${e.name}\` define?`,
    generateResponse: (e) => {
      if (e.docstring) return e.docstring;
      if (e.properties?.length) return `\`${e.name}\` defines: ${e.properties.join(', ')}.`;
      return `\`${e.name}\` is a ${e.type} defined in ${e.file}.`;
    }
  }
];

/**
 * getTemplatesForEntity - Get all applicable templates for an entity
 * 
 * Filters the template list to only those that apply to the given
 * entity's type.
 * 
 * @param entity - The code entity to get templates for
 * @returns Array of applicable QuestionTemplates
 */
export function getTemplatesForEntity(entity: CodeEntity): QuestionTemplate[] {
  return TEMPLATES.filter(t => t.applicableTo.includes(entity.type as any));
}
