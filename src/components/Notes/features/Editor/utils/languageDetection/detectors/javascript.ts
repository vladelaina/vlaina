import type { LanguageDetector } from '../types';

export const detectJavaScript: LanguageDetector = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces, hasSemicolon, hasImport, hasConst, hasLet, hasFunction, code, lines } = ctx;

  if (/^#{1,6}\s+/m.test(first100Lines) && /```\w*/.test(code)) {
    return null;
  }

  if (/^require(?:_relative)?\s+['"]/m.test(first100Lines)) {
    return null;
  }

  if (/^import\s+(?:static\s+)?(?:java|javax|jakarta|org\.(?:springframework|junit|apache|jooq)|com\.(?:fasterxml|google|intellij)|lombok|javafx)\./m.test(first100Lines)) {
    return null;
  }

  if (/^(?:from\s+[._a-z][\w.]*\s+import\s+|import\s+(?:os|sys|re|json|datetime|pathlib|typing|collections|itertools|functools|contextlib|decimal|fractions|subprocess|tempfile|uuid|logging|pytest|unittest|django|fastapi|pydantic|sqlite3|httpx|requests|argparse|click|rich)\b)/m.test(first100Lines)) {
    return null;
  }

  if (/^\s*task\s+['"][^'"]+['"]\s*,\s*->/m.test(first100Lines) || /\bconsole\.(?:log|error|warn|info)\s+['"]/m.test(code)) {
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

  if (/^\\(name|alias|title|usage|arguments|value|description|details|docType)\{/m.test(first100Lines)) {
    return null;
  }

  if (/^#include\s*[<"]/m.test(first100Lines) || /^#\s*(define|ifdef|ifndef|elif|else|endif)\b/m.test(first100Lines) || /\b(public|private|protected):\s*$/m.test(code) || /\b(enum\s+class|virtual|override|noexcept|constexpr)\b/.test(code) || /\btemplate\s*</.test(code) || /\boperator\s*(?:[+\-*/%<>=!]+|\(\)|\[\])/.test(code) || /\bstd::/.test(code) || /\b(typedef\s+struct|typedef\s+void\s*\(\*|union\s+\w+\s*\{|restrict\b|volatile\b|extern\s+\w|static\s+inline)\b/.test(code) || /^struct\s+\w+\s*\{/m.test(code) || /^enum\s+\w+\s*\{/m.test(code) || /\bconst\s+char\s*\*/.test(code) || /\bunsigned\s+long\b/.test(code) || /\b(?:int|char|float|double|short|long|unsigned|signed|void)\s+\**\w+\s*\([^)]*\)\s*\{/.test(code)) {
    return null;
  }

  if (sample.includes('<?php') ||
      sample.includes('#include <') ||
      /^package\s+\w+;/m.test(first100Lines) ||
      /\b(public\s+class|private\s+class|protected\s+class)\b/.test(first100Lines) ||
      /\b(fn\s+main|let\s+mut|impl\s+|pub\s+fn)\b/.test(first100Lines)) {
    return null;
  }

  // Exclude Objective-C files
  if (/#import\s+["<]/.test(first100Lines) &&
      (/@(interface|implementation|property|protocol)\b/.test(code) ||
       /\bNS[A-Z]\w+\s*\*/.test(first100Lines) ||
       /#import\s+<(Foundation|UIKit|CoreFoundation|CFNetwork)\//.test(first100Lines))) {
    return null;
  }

  if (/\b(proc|iterator|template|macro)\s+\w+/.test(first100Lines)) {
    return null;
  }

  if (/^task\s+['"]/.test(first100Lines) && /->/.test(code)) {
    return null;
  }

  if (/\b(Get|Set|New|Remove|Add|Clear|Write|Read|Test|Start|Stop|Invoke|Import|Export)-[A-Z]\w+/.test(code)) {
    return null;
  }

  if (/^\s*param\s*\(/m.test(code) && /\$[\w]+/.test(code)) {
    return null;
  }

  if (/\bfunction\s+\w+\s*\([^)]*\$\w+/.test(first100Lines) ||
      /^namespace\s+[A-Z]\w*(\\[A-Z]\w*)*;$/m.test(first100Lines) ||
      /\breturn\s+\$\w+;/.test(code)) {
    return null;
  }

  if (/^class\s+\w+/m.test(code)) {

    if (/->|=>/.test(code) || /constructor:\s*\([^)]*@/.test(code) || /@\w+/.test(code)) {
      return null;
    }
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

  if (/^#!.*crystal/.test(firstLine) ||
      /require\s+["'].*spec_helper["']/.test(first100Lines) ||
      (/\bdescribe\s+["']/.test(code) && /\.should\s+(eq|be_true|be_false|be_nil)/.test(code))) {
    return null;
  }

  if (/^package\s+\w+$/m.test(first100Lines)) {

    if (/\bfunc\s+\w+\s*\(/.test(first100Lines) ||
        /\btype\s+\w+\s+struct/.test(first100Lines) ||
        /protobuf:"/.test(first100Lines) ||
        /Code generated by protoc/.test(first100Lines)) {
      return null;
    }
  }

  if (/\b(CREATE\s+TABLE|INSERT\s+INTO|SELECT\s+.*\s+FROM|DROP\s+TABLE|SHOW\s+WARNINGS|GRANT\s+\w+\s+TO)\b/i.test(first100Lines)) {
    return null;
  }

  if (/<-/.test(first100Lines) && /\b(library|function|data\.frame)\b/.test(first100Lines)) {

    if (!/\/\/.*<-|\/\*.*<-/.test(first100Lines)) {
      return null;
    }
  }

  if (/^function\s+\w+\s*\(/m.test(first100Lines) && /\bend\b/.test(code)) {

    if (!/\b(var|const|let)\s+\w+\s*=/.test(first100Lines) &&
        !/\bObject\.(defineProperty|create|setPrototypeOf)/.test(first100Lines)) {
      return null;
    }
  }

  if (/^function\s+\w+\s*=\s*\w+\s*\(/m.test(first100Lines) || (/^%\s/m.test(first100Lines) && /\bfunction\b/.test(first100Lines))) {
    return null;
  }

  if (/^(import|module)\s+[A-Z][\w.]*\s+exposing/m.test(first100Lines)) {
    return null;
  }

  const capitalizedImports = (first100Lines.match(/^import\s+[A-Z][\w.]*\s*$/gm) || []).length;
  if (capitalizedImports >= 2) {
    return null;
  }

  if (/^use\s+(strict|warnings|v\d+)/.test(first100Lines) || /^package\s+[\w:]+;/.test(first100Lines)) {
    return null;
  }

  if (/\b(let\s+\w+\s*=|module\s+\w+\s*=|open\s+\w+)\b/.test(first100Lines) && /\bin\b/.test(code)) {
    return null;
  }

  if (/\b(require\s+["']|property\s+\w+|getter\s+\w+|setter\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (/^(set|let|if|endif|colorscheme)\s+/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Vim Script function declarations (function! not function)
  if (/^function!\s+/.test(first100Lines)) {
    return null;
  }

  if (/^"\s/m.test(first100Lines) &&
      (/\b(function!|endfunction|call\s+\w+|set\s+\w+|let\s+[gbslwtav]:)\b/.test(first100Lines) ||
       /UseVimball/.test(first100Lines))) {
    return null;
  }

  if (firstLine.includes('<?xml')) {
    return null;
  }

  if (firstLine.includes('<Query Kind=')) {
    return null;
  }

  if (/\bArgument<\w+>/.test(first100Lines)) {
    return null;
  }

  if (/\b(MACRO|ENDMACRO|FUNCTION|ENDFUNCTION|FOREACH|ENDFOREACH|WHILE|ENDWHILE)\s*\(/g.test(first100Lines) ||
      /CMAKE_/.test(first100Lines)) {
    return null;
  }

  if (/\blocal\s+\w+\s*=/.test(first100Lines)) {
    return null;
  }

  if (/^---\s*$/.test(firstLine) && /^#{1,6}\s+/m.test(first100Lines)) {
    return null;
  }

  const headerMatches = first100Lines.match(/^#{1,6}\s+/gm);
  if (headerMatches && headerMatches.length >= 2) {
    return null;
  }

  if (/\{%[\s\S]*?%\}/.test(first100Lines) && /\{\{[\s\S]*?\|/.test(first100Lines)) {
    return null;
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
