import type { LanguageDetector } from '../types';
import { shouldRejectAfterJavaScriptSignals, shouldRejectBeforeJavaScriptSignals } from './javascriptRejections';

export const detectJavaScript: LanguageDetector = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces, hasSemicolon, hasImport, hasConst, hasLet, hasFunction, code, lines } = ctx;

  if (shouldRejectBeforeJavaScriptSignals(ctx)) {
    return null;
  }

  const hasJsArrowAssignment = /\b(?:const|let|var)\s+\w+\s*=\s*(?:\([^)]*\)|\w+)\s*=>/.test(first100Lines);
  const hasJsSpreadLiteral = /\b(?:const|let|var)\s+\w+\s*=\s*[\[{][\s\S]*\.\.\./.test(code);
  const hasJsRequire = /\b(?:const|let|var)\s+\w+\s*=\s*require\(["'][^"']+["']\)/.test(code);
  const hasJsModuleExports = /\b(?:module\.exports|exports\.\w+)\s*=/.test(code);
  const hasJsImportExport = /^(?:import\s+.+\s+from\s+["']|export\s+(?:default|const|function|class)\b)/m.test(first100Lines);
  const hasJsAsyncFunction = /\basync\s+function\s+\w+\s*\(/.test(code);
  const hasJsPlainFunction = /(?:^|\n)\s*function\*?\s+\w+\s*\([^):]*\)\s*\{/.test(code);
  const hasJsClassSyntax = /\bclass\s+\w+(?:\s+extends\s+\w+)?\s*\{/.test(code) && (/\bconstructor\s*\(/.test(code) || /\bstatic\s+\w+\s*\(/.test(code) || /\bget\s+\w+\s*\(/.test(code) || /\bset\s+\w+\s*\(/.test(code) || /#\w+\s*=/.test(code) || /\bstatic\s*\{/.test(code));
  const hasJsRuntime = /\b(?:console\.(?:log|error|warn|info|table)|document\.|window\.|localStorage|sessionStorage|fetch\(|addEventListener\(|setTimeout\(|setInterval\(|clearTimeout\(|clearInterval\(|URLSearchParams|AbortController|Promise\.(?:all|race|any)|queueMicrotask|JSON\.parse|Object\.(?:fromEntries|entries|hasOwn)|Reflect\.ownKeys|import\.meta|navigator\.clipboard|history\.pushState|indexedDB\.open|FormData|Blob|Response|Headers|WebSocket|IntersectionObserver|MutationObserver|ResizeObserver|requestAnimationFrame|structuredClone|Buffer\.from|process\.env|customElements\.define)\b/.test(code);
  const hasJsModernOperator = /\?\.|\?\?=?|\|\|=|&&=|\b(?:findLast|toSorted|flatMap|matchAll)\s*\(/.test(code);
  const hasTypeScriptSyntax = /\b(?:interface|type|enum|namespace|readonly|implements|abstract\s+class)\b/.test(first100Lines) || /\b(?:public|private|protected)\s+\w+/.test(first100Lines) || /import\s+type\s+/.test(first100Lines) || /function\s+\w+\s*\([^)]*:\s*\w+/.test(first100Lines) || /\)\s*:\s*\w+/.test(first100Lines) || /const\s+\w+\s*=\s*\([^)]*:\s*\w+/.test(first100Lines);

  if (!hasTypeScriptSyntax && (hasJsImportExport || hasJsRequire || hasJsModuleExports || hasJsArrowAssignment || hasJsSpreadLiteral || hasJsAsyncFunction || hasJsPlainFunction || hasJsClassSyntax || hasJsRuntime || hasJsModernOperator)) {
    return 'javascript';
  }

  if (shouldRejectAfterJavaScriptSignals(ctx)) {
    return null;
  }

  // Detect React/JSX - should be treated as JavaScript
  if (/\bimport\s+.*from\s+['"]react['"]/.test(first100Lines) ||
      /\bimport\s+\{[^}]*\}\s+from\s+['"]react['"]/.test(first100Lines)) {
    return 'javascript';
  }

  // Detect Express/Node.js patterns
  if (/\brequire\s*\(\s*['"]express['"]\s*\)/.test(first100Lines) ||
      /\bapp\.(get|post|put|delete|use)\s*\(/.test(code)) {
    return 'javascript';
  }

  // Exclude CoffeeScript (has arrow functions without function keyword)
  if (/->|=>/.test(code)) {
    // CoffeeScript pattern: assignment with arrow function
    if (/\w+\s*=\s*\([^)]*\)\s*->/.test(code) || /\w+\s*=\s*->/.test(code)) {
      if (!/\bfunction\b/.test(first100Lines) && !/\bconst\b|\blet\b|\bvar\b/.test(first100Lines)) {
        return null; // Let CoffeeScript handle it
      }
    }
  }

  if (/->|=>/.test(code) && /@\w+/.test(code) && !/\bfunction\b/.test(first100Lines)) {

    if (/\b(import|export)\s+/.test(first100Lines) ||
        /:\s*\w+\s*[=;)]/.test(first100Lines) ||
        /\b(interface|type|abstract|implements)\b/.test(first100Lines)) {

    } else {
      return null;
    }
  }

  if (/\bconstructor\s*\(\s*(public|private|protected)\s+\w+\s*\)/.test(first100Lines)) {
    return 'typescript';
  }

  if (!hasTypeScriptSyntax && /(?:^|\n)\s*function\s+\w+\s*\([^):]*\)\s*\{/.test(code)) {
    return 'javascript';
  }

  // TypeScript type annotations in function parameters
  if (/function\s+\w+\s*\([^)]*:\s*(string|number|boolean|any|void)\s*\)/.test(first100Lines)) {
    return 'typescript';
  }
  
  // TypeScript function with return type
  if (/function\s+\w+\s*\([^)]*\)\s*:\s*(string|number|boolean|any|void|Promise)/.test(first100Lines)) {
    return 'typescript';
  }

  if (/\bfunction\s+\w+\s*\([\s\S]*?:\s*\w+/.test(first100Lines)) {
    return 'typescript';
  }

  if (/\(\s*\w+:\s*(string|number|boolean|any|void|Promise|Array)[^)]*\)\s*(:|=>)/.test(first100Lines)) {
    return 'typescript';
  }

  if (/\bexport\s+function\s+\w+\s*\([\s\S]*?:\s*\w+/.test(first100Lines)) {
    return 'typescript';
  }

  if (/\binterface\s+\w+\s*\{/.test(first100Lines)) {
    return 'typescript';
  }

  if (/^(interface|type)\s+\w+\s*=/.test(first100Lines)) {
    return 'typescript';
  }

  // TypeScript generics
  if (/function\s+\w+<[A-Z]\w*>/.test(first100Lines)) {
    return 'typescript';
  }
  
  // TypeScript generic with parameter
  if (/function\s+\w+<[A-Z]>\s*\(\s*\w+:\s*[A-Z]\s*\)\s*:\s*[A-Z]/.test(code)) {
    return 'typescript';
  }

  if (/^type\s+\w+\s*=\s*\{/.test(first100Lines)) {
    return 'typescript';
  }

  const tsIndicators = [
    /\binterface\s+\w+\s*\{/.test(first100Lines),
    /\btype\s+\w+\s*=/.test(first100Lines),
    /\bexport\s+type\s+\w+/.test(first100Lines),
    /\babstract\s+class\b/.test(first100Lines),
    /\bimplements\s+\w+/.test(first100Lines),
    /\b(public|private|protected)\s+(readonly\s+)?\w+:\s*\w+/.test(first100Lines),
    /\b(public|private|protected)\s+abstract\s+\w+/.test(first100Lines),
    /<T>|<T,|<\w+>/.test(first100Lines),
    /:\s*(Promise<|Array<)/.test(first100Lines)
  ].filter(Boolean).length;

  if (tsIndicators >= 2) {
    return 'typescript';
  }

  if ((/<[A-Z]\w+/.test(first100Lines) || /return\s*\(?\s*<[a-z]+/.test(first100Lines)) &&
      !/\bfn\s+\w+\s*\([^)]*\)\s*->/.test(first100Lines) &&
      !/\bOption<[A-Z]\w*>/.test(first100Lines) &&
      !/#import\s+</.test(first100Lines)) {
    if (/\bexport\s+default\s+function\s+\w+\s*\(\s*\)\s*\{/.test(first100Lines)) {
      return 'jsx';
    }
    if (tsIndicators >= 1 || sample.includes('interface ')) {
      return 'tsx';
    }
    return 'jsx';
  }

  // Simple console.log without type annotations should be JavaScript
  if (lines.length <= 3 && /^console\.log\(/.test(first100Lines.trim())) {
    // Check if there are NO type annotations
    if (!/:\s*(string|number|boolean|any|void|Promise|Array|<T>)/.test(code)) {
      return 'javascript';
    }
  }

  if (/\bconst\s+\w+\s*=\s*await\s+fetch\(/.test(first100Lines)) {
    if (!/\b(final|FirebaseFirestore|Widget|BuildContext)\b/.test(first100Lines)) {
      return 'javascript';
    }
  }

  if (/\.\s*(map|filter|find|reduce|some|every)\s*\([\s\S]*=>/.test(first100Lines)) {
    return 'javascript';
  }

  if (/\b(console\.(log|error|warn|info)|alert|document\.|window\.|require\(|module\.exports)\b/.test(first100Lines)) {

    if (ctx.lines.length <= 3 && /^console\.log\(/.test(first100Lines.trim())) {
      return 'typescript';
    }
    return 'javascript';
  }

  if (/\bconst\s+\w+\s*=\s*await\s+fetch\(/.test(first100Lines)) {
    if (!/\b(final|var)\s+\w+\s*=\s*await/.test(first100Lines)) {
      return 'javascript';
    }
  }

  if (/\b(import\.meta|await\s+Promise|await\s+\w+\()\b/.test(first100Lines)) {

    if (/\bexport\s+(function|const|class|default|type|interface)/.test(first100Lines)) {

      if (tsIndicators >= 1 || /:\s*\w+\s*[=;)]/.test(first100Lines)) {
        return 'typescript';
      }
      return 'javascript';
    }
  }

  // Arrow function patterns - detect early
  const hasArrowFunction = /=>\s*/.test(first100Lines);
  const hasConstArrow = /\bconst\s+\w+\s*=\s*\([^)]*\)\s*=>/.test(first100Lines);
  const hasLetArrow = /\blet\s+\w+\s*=\s*\([^)]*\)\s*=>/.test(first100Lines);
  
  // Single line arrow function: const add = (a, b) => a + b;
  if (hasConstArrow || hasLetArrow) {
    return 'javascript';
  }
  
  if (!hasCurlyBraces && !hasSemicolon && !hasImport && !hasConst && !hasLet && !hasFunction && !hasArrowFunction) {
    return null;
  }

  const jsScore = (
    (hasImport && /^import\s+/.test(firstLine) ? 2 : 0) +
    ((hasConst || hasLet) ? 1 : 0) +
    (hasFunction || /=>\s*\{/.test(first100Lines) || /function\s+\w+\s*\(/.test(first100Lines) ? 2 : 0) +
    (/\b(console\.|document\.|window\.|require\(|module\.exports|exports\.|async\s+function|await\s+|Object\.|Array\.|alert\()\b/.test(first100Lines) ? 2 : 0) +
    (hasCurlyBraces && hasSemicolon ? 1 : 0) +
    (/\bvar\s+\w+\s*=/.test(first100Lines) ? 1 : 0) +
    (/!\s*function\s*\(/.test(first100Lines) ? 2 : 0) +
    (/\$\s*\(/.test(first100Lines) ? 1 : 0) +
    (/\bexport\s+(function|const|class|default)/.test(first100Lines) ? 2 : 0) +
    (/\bimport\.meta\b/.test(first100Lines) ? 2 : 0) +
    (hasArrowFunction ? 1 : 0) +
    // JavaScript class with constructor
    (/\bclass\s+\w+\s*\{[\s\S]*?\bconstructor\s*\(/.test(code) ? 2 : 0)
  );

  // Don't give points for just having class keyword, as C++ also has it
  // Only return JavaScript if we have strong indicators
  if (jsScore >= 2) {
    return 'javascript';
  }

  return null;
};
