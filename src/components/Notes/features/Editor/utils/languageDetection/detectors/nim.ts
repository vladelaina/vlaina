import type { LanguageDetector } from '../types';

export const detectNim: LanguageDetector = (ctx) => {
  const { code, first100Lines, firstLine } = ctx;

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
