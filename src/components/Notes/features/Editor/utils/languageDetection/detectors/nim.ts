import type { LanguageDetector } from '../types';

export const detectNim: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine, lines } = ctx;

  // Simple single-line Nim patterns
  if (lines.length <= 3) {
    // Nim echo is very distinctive - it doesn't use $ for variables like bash
    if (/^echo\s+["']/.test(code.trim())) {
      // If it has bash-specific patterns, let shell handle it
      if (/\$\{|\$\(|\$\w+|`.*`|\|\||&&|;/.test(code)) {
        return null;
      }
      // If it's just echo "string" with nothing else, it's ambiguous
      // Default to bash (more common)
      if (/^echo\s+["'][^"']*["']\s*$/.test(code.trim())) {
        return null;
      }
      // If it has Nim-specific keywords, it's Nim
      if (/\bproc\b|\bvar\b|\blet\b|\bimport\b/.test(code)) {
        return 'nim';
      }
      return null;
    }
    // Nim variable with type annotation
    if (/\bvar\s+\w+\s*:\s*\w+\s*=/.test(code)) {
      // Check if it's not TypeScript/JavaScript
      if (!/\b(const|let|function|class|interface|type)\b/.test(code)) {
        return 'nim';
      }
    }
  }

  if (/^(hint|path|define|symbol|cs|gc|opt|warning)\[?\w*\]?:/m.test(first100Lines)) {
    return 'nim';
  }

  if (/^(version|author|description|license|srcDir|binDir|skipDirs|skipFiles|skipExt|installDirs|installFiles|installExt|backend|bin)\s*=/m.test(code)) {

    if (/\brequires\s+["']|^task\s+\w+,/m.test(code)) {
      return 'nim';
    }
  }

  if (/@(import|errorName|as|cImport|embedFile|field|typeInfo|TypeOf|sizeOf)\b/.test(first100Lines)) {
    return null;
  }

  if (/^from\s+(macros|ospaths|strutils|sequtils|os|times|json)\s+import\b/m.test(code)) {
    return 'nim';
  }

  if (/\b(import|export)\s+/.test(first100Lines)) {

    if (/import\s+\w+\s*=\s*require\(|export\s*=/.test(first100Lines)) {
      return null;
    }

    if (/import\s+.*\s+from\s+|export\s+(default|const|function|class|interface|type)/.test(first100Lines)) {
      return null;
    }
  }

  if (/^---\s*$/.test(firstLine)) {

    if (!/\b(proc|when|template|import|const)\b/.test(first100Lines)) {
      return null;
    }
  }

  if (/^FROM\s+\w+/m.test(first100Lines) || /^RUN\s+/.test(first100Lines)) {
    return null;
  }

  if (/^#!/.test(firstLine) && /\b(echo|if|then|fi|for|do|done)\b/.test(first100Lines)) {
    return null;
  }

  if (/\{%[\s\S]*?%\}/.test(first100Lines) && /\{\{[\s\S]*?\|/.test(first100Lines)) {
    return null;
  }

  if (/^[a-zA-Z_][\w-]*:\s*/.test(first100Lines) && !/\b(proc|when|template|import)\b/.test(first100Lines)) {
    return null;
  }

  if (/\bcollect\s*\(\s*newSeq\s*\)/.test(code)) {
    return 'nim';
  }

  if (/\blet\s+\w+\s*=\s*collect\s*\(/.test(code)) {
    return 'nim';
  }

  if (/\{\.[\w,\s:"]+\.\}/.test(code)) {
    return 'nim';
  }

  if (/\bwhen\s+defined\(/.test(code)) {
    return 'nim';
  }

  if (/\b(proc|iterator|template|macro)\s+\w+\*?[\(\[]/.test(code)) {
    return 'nim';
  }

  if (/\btask\s+\w+,\s*"/.test(code)) {
    return 'nim';
  }

  if (/\bswitch\(\s*["']/.test(code)) {
    return 'nim';
  }

  if (/\b(nimexec|withDir|execShellCmd|getCurrentDir|setCurrentDir|projectDir|getEnv|selfExec|setCommand|paramCount|paramStr|dirExists|listFiles|fileExists|mkDir)\(/.test(code)) {
    return 'nim';
  }

  if (/^import\s*$/m.test(code)) {
    return 'nim';
  }

  if (/^import\s+\w+(?:,\s*\w+)+\s*$/m.test(code)) {
    return 'nim';
  }

  if (/^import\s+\w+\s*\/\s*\w+/m.test(code)) {
    return 'nim';
  }

  if (/^from\s+\w+\s+import\s+\w+/m.test(code)) {

    if (/\b(proc|template|when|const|let|var|discard|echo)\b/.test(code)) {
      return 'nim';
    }
  }

  if (/^(const|let)\s*$/m.test(code) || /^(const|let)\s+\w+\s*=/.test(code)) {

    if (/\b(when|proc|template|import)\b/.test(code)) {
      return 'nim';
    }
  }

  return null;
};
