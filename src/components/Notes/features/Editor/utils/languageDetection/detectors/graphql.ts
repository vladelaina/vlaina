import type { LanguageDetector } from '../types';

export const detectGraphQL: LanguageDetector = (ctx) => {
  const { code } = ctx;

  if (/\b(import|export|const|let|var|require|function|class|interface|namespace|declare)\b/.test(code) || /(?:^|\n)\s*type\s+\w+(?:<[^>\n]+>)?\s*=/.test(code)) {
    return null;
  }

  // Simple single-line GraphQL query: { user(id: 1) { name email } }
  if (ctx.lines.length <= 3) {
    const trimmed = code.trim();
    // GraphQL query with nested braces
    if (/^\{\s*\w+\s*\([^)]*\)\s*\{[^}]+\}\s*\}$/.test(trimmed)) {
      return 'graphql';
    }
    // GraphQL query without arguments
    if (/^\{\s*\w+\s*\{[^}]+\}\s*\}$/.test(trimmed)) {
      return 'graphql';
    }
  }

  if (/^package\s+[\w.]+;/m.test(code) || /^import\s+java\./m.test(code)) {
    return null;
  }

  if (/^fragment\s+\w+\s+on\s+\w+/.test(code)) {
    return 'graphql';
  }

  if (/^query\s+\w+\s*\(\s*\$\w+:\s*\w+/.test(code)) {
    return 'graphql';
  }

  if (/^(query|mutation|subscription)\s+\w+\s*(\([^)]*\))?\s*\{/.test(code)) {
    return 'graphql';
  }

  if (/\{\s*\w+\s*(\([^)]*\))?\s*\{\s*\w+/.test(code) && /\}/.test(code)) {
    if (/(query|mutation|fragment|type)\s+/.test(code) || /\$\w+:\s*\w+!?/.test(code)) {
      return 'graphql';
    }
  }

  const graphqlKeywords = /\b(type|query|mutation|subscription|fragment|schema|input|interface|union|enum|scalar|directive|extend|implements)\b/;

  if (!graphqlKeywords.test(code)) {
    return null;
  }

  if (/type\s+\w+\s*\{/.test(code)) {
    return 'graphql';
  }

  if (/(query|mutation|subscription)\s+\w*\s*\{/.test(code)) {
    return 'graphql';
  }

  if (/schema\s*\{/.test(code)) {
    return 'graphql';
  }

  return null;
};
