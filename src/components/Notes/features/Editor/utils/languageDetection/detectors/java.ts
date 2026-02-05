import type { LanguageDetector } from '../types';

export const detectJava: LanguageDetector = (ctx) => {
  const { first100Lines, code, lines } = ctx;

  // Simple single-line Java patterns
  if (lines.length <= 3) {
    // Static import: import static java.lang.Math.*;
    if (/^import\s+static\s+java\./.test(code.trim())) {
      return 'java';
    }
    if (/\bSystem\.(out|err)\.(print|println)\(/.test(code)) {
      return 'java';
    }
  }

  if (/^use\s+(strict|warnings|lib)\b/m.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w:]+;/m.test(first100Lines) && /\b(my|our|local)\s+[\$@%]|\$\w+\s*=/.test(first100Lines)) {
    return null;
  }

  if (/\b(type\s+\w+\s*\{|interface\s+\w+\s*\{|query\s+\w+\s*\{|mutation\s+\w+\s*\{)\b/.test(first100Lines)) {
    return null;
  }

  if (/@[\w-]+\s*:/.test(first100Lines) && /\{[\s\S]*?\}/.test(first100Lines)) {
    return null;
  }

  // Java annotations (must be before C# check)
  if (/^@(RestController|RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping|Autowired|Component|Service|Repository|Controller)\b/m.test(code)) {
    return 'java';
  }

  if (/^package\s+[\w.]+;/m.test(code) || /^import\s+java\./m.test(code)) {
    return 'java';
  }

  if (/^import\s+(org\.(apache|jooq|intellij|junit)|com\.intellij)\./m.test(code)) {
    return 'java';
  }

  if (/\bOptional<\w+>/.test(code)) {
    return 'java';
  }

  if (/\bStream\.(of|iterate|generate)\s*\(/.test(code)) {
    return 'java';
  }

  if (/\bCollectors\.(toList|toSet|toMap|groupingBy)/.test(code)) {
    return 'java';
  }

  if (/\b(List|Map|Set|ArrayList|HashMap|HashSet)<[A-Z]\w*>/.test(code)) {
    if (!/\b(return\s*<|<\/\w+>|<\w+[^>]*>.*<\/\w+>|interface\s+\w+\s*\{|:\s*\w+\s*[=;)]|export\s+default\s+function|const\s+\w+\s*=|import\s+.*from)\b/.test(code)) {
      if (/\b(Arrays\.asList|System\.|public\s+static\s+void\s+main|@Override|@Test)\b/.test(code)) {
        return 'java';
      }
      return 'java';
    }
  }

  if (/\bList<String>\s+\w+\s*=\s*Arrays\.asList/.test(code)) {
    return 'java';
  }

  if (/\bArrays\.asList\(/.test(code)) {
    return 'java';
  }

  if (/^@(Override|Deprecated|SuppressWarnings|Test|Before|After|Entity|Table|Column|Id|Autowired|Component|Service|Repository|Controller|RequestMapping|GetMapping|PostMapping)\b/m.test(code)) {
    return 'java';
  }

  if (/\bpublic\s+static\s+void\s+main\s*\(\s*String\[\]\s+\w+\s*\)/.test(code)) {
    return 'java';
  }

  // Java class with methods
  if (/\b(public|private|protected)\s+(static\s+)?(class|interface|enum)\s+\w+/.test(first100Lines)) {
    if (/\b(public|private|protected)\s+(static\s+)?\w+\s+\w+\s*\([^)]*\)\s*\{/.test(code)) {
      return 'java';
    }
    if (/\b(public\s+static\s+void\s+main|System\.out\.|@Override|@SuppressWarnings|extends\s+\w+|implements\s+\w+)\b/.test(first100Lines)) {
      return 'java';
    }
  }

  return null;
};
