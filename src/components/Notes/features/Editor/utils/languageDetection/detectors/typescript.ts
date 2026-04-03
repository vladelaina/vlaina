import type { LanguageDetector } from '../types';

export const detectTypeScript: LanguageDetector = (ctx) => {
  const { code, first100Lines, hasSemicolon, lines } = ctx;

  if (/#include\s*[<"]/.test(first100Lines) || /\b(printf|scanf|malloc|free|sizeof)\s*\(/.test(code)) {
    return null;
  }

  if (/^enum\s+\w+\s*\{/m.test(first100Lines) && /\b(int|char|float|double|void)\s+\w+\s*\([^)]*\)\s*\{/.test(code)) {
    return null;
  }

  // Simple single-line TypeScript patterns
  if (lines.length <= 3) {
    // Type annotation in function
    if (/function\s+\w+\s*\([^)]*:\s*\w+[^)]*\)\s*:\s*\w+/.test(code.trim())) {
      return 'typescript';
    }
  }

  // TypeScript generic function
  if (/function\s+\w+<[A-Z]\w*>/.test(code)) {
    if (/:\s*[A-Z]\w*/.test(code)) {
      return 'typescript';
    }
  }

  // TypeScript complex generics (e.g., function groupBy<T, K extends keyof T>)
  if (/function\s+\w+<[^>]+>\s*\(/.test(first100Lines) ||
      /<[A-Z]\w*(?:\s*,\s*[A-Z]\w*)*(?:\s+extends\s+[^>]+)?>\s*\(/.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript Record, Omit, Pick, etc.
  if (/:\s*(Record|Omit|Pick|Partial|Required)</.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript type annotations in function parameters or return types
  if (/function\s+\w+\s*\([^)]*:\s*\w+/.test(first100Lines)) {
    if (/:\s*(string|number|boolean|void|any|unknown|never)\b/.test(first100Lines)) {
      return 'typescript';
    }
    // Check for return type annotation
    if (/\)\s*:\s*\w+/.test(first100Lines)) {
      return 'typescript';
    }
  }

  // TypeScript interface
  if (/^interface\s+\w+\s*\{/m.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript type alias
  if (/^type\s+\w+\s*=\s*\{/m.test(first100Lines)) {
    return 'typescript';
  }

  if (/^type\s+\w+<[^>]+>\s*=/.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript enum
  if (/^enum\s+\w+\s*\{/m.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript namespace
  if (/^namespace\s+\w+\s*\{/m.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript decorators
  if (/@\w+\s*\(/m.test(first100Lines) && /class\s+\w+/.test(first100Lines)) {
    if (/:\s*(string|number|boolean|void|any)\b/.test(first100Lines)) {
      return 'typescript';
    }
  }

  // TypeScript as keyword
  if (/\bas\s+(string|number|boolean|const|any|unknown)\b/.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript generic types
  if (/<[A-Z]\w*>/.test(code) && /:\s*[A-Z]\w*/.test(code)) {
    if (/function\s+\w+/.test(code) || /const\s+\w+/.test(code)) {
      return 'typescript';
    }
  }

  // TypeScript import with type
  if (/import\s+type\s+\{/.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript export with type
  if (/export\s+type\s+\w+/.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript class with typed properties
  if (/class\s+\w+/.test(first100Lines)) {
    if (/\w+:\s*(string|number|boolean|any)\b/.test(first100Lines)) {
      return 'typescript';
    }
  }

  // TypeScript arrow function with type annotation
  if (/const\s+\w+\s*=\s*\([^)]*:\s*\w+[^)]*\)\s*=>/.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript readonly modifier
  if (/\breadonly\s+\w+/.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript public/private/protected modifiers
  if (/\b(public|private|protected)\s+\w+/.test(first100Lines)) {
    if (hasSemicolon) {
      return 'typescript';
    }
  }

  return null;
};
