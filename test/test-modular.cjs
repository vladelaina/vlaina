const fs = require('fs');
const path = require('path');

// ===== Common utilities =====
function createContext(code) {
  const text = code.trim();
  const maxLength = 50000;
  const sample = text.length > maxLength ? text.slice(0, maxLength) : text;
  
  const lines = sample.split('\n');
  const firstLine = lines[0] || '';
  const first20Lines = lines.slice(0, 20).join('\n');
  const first100Lines = lines.slice(0, 100).join('\n');
  
  return {
    code: text,
    sample,
    lines,
    firstLine,
    first20Lines,
    first100Lines,
    
    hasCurlyBraces: sample.includes('{'),
    hasArrow: sample.includes('->'),
    hasDoubleColon: sample.includes('::'),
    hasImport: sample.includes('import'),
    hasFunction: sample.includes('function'),
    hasConst: sample.includes('const'),
    hasLet: sample.includes('let'),
    hasClass: sample.includes('class'),
    hasSemicolon: sample.includes(';'),
  };
}

function checkShebang(ctx) {
  const { firstLine, lines } = ctx;
  
  if (!firstLine.startsWith('#!')) return null;
  
  // Check for Scala shebang scripts - #!/bin/sh followed by exec scala
  if ((firstLine.includes('/bash') || firstLine.includes('/sh')) && 
      lines.length > 1 && lines[1].includes('exec scala')) {
    return 'scala';
  }
  
  if (firstLine.includes('/bash') || firstLine.includes('/sh')) {
    if (firstLine.includes('/fish')) return 'fish';
    if (firstLine.includes('/zsh')) return 'zsh';
    return 'bash';
  }
  if (firstLine.includes('/awk')) return 'awk';
  if (firstLine.includes('/expect')) return 'tcl';
  if (firstLine.includes('/python')) return 'python';
  if (firstLine.includes('/ruby')) return 'ruby';
  if (firstLine.includes('/node')) return 'javascript';
  if (firstLine.includes('perl')) return 'perl';
  
  return null;
}

// ===== PHP Detector =====
const detectPHP = (ctx) => {
  const { sample } = ctx;
  
  if (sample.includes('<?php') || sample.includes('<?=')) {
    return 'php';
  }
  
  return null;
};

// ===== Python Detector =====
const detectPython = (ctx) => {
  const { firstLine, first100Lines, lines, hasCurlyBraces } = ctx;
  
  if (firstLine.startsWith('# -*- coding:') || firstLine.startsWith('# coding:')) {
    return 'python';
  }
  
  // Exclude Scala files - check for Scala imports
  if (/^import\s+scala\./m.test(first100Lines) || /^import\s+math\.random$/m.test(first100Lines)) {
    return null;
  }
  
  if (!/\b(def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import|if\s+.*:|elif\s+.*:|else:|print\(|lambda\s+|with\s+.*:|async\s+def|@\w+\s*\n\s*def)\b/.test(first100Lines)) {
    return null;
  }
  
  const pythonScore = (
    (/\b(def\s+\w+\s*\(|class\s+\w+\s*:)/.test(first100Lines) ? 2 : 0) +
    (/\b(self|__init__|__name__|__main__|None|True|False|range\(|append\(|len\()\b/.test(first100Lines) ? 2 : 0) +
    (/^(def|class|import|from)\s+/.test(firstLine) ? 1 : 0) +
    (lines.slice(0, 20).filter(l => /^\s{4}|\t/.test(l)).length > 2 ? 1 : 0) +
    (!hasCurlyBraces ? 1 : 0)
  );
  
  if (pythonScore >= 3) {
    return 'python';
  }
  
  return null;
};

// ===== C/C++ Detector =====
const detectCPP = (ctx) => {
  const { first100Lines, sample, hasDoubleColon, hasClass } = ctx;
  
  // Exclude JavaScript/TypeScript files - must check before any C++ detection
  if (/\b(console\.(log|error|warn)|alert\(|document\.|window\.|require\(|module\.exports|exports\.|import\s+.*from|export\s+(default|const|function)|Object\.defineProperty|var\s+\w+\s*=\s*function)\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude JavaScript files with many var declarations (e.g., generated parsers)
  const varCount = (first100Lines.match(/\bvar\s+\w+\s*=/g) || []).length;
  if (varCount >= 5) {
    return null;
  }
  
  // Exclude JavaScript files with function declarations
  if (/\bfunction\s+\w+\s*\(/.test(first100Lines)) {
    // If it has function declarations but no strong C/C++ indicators, it's likely JavaScript
    // NULL alone is not enough (could be in comments), need #include or actual C functions
    if (!/#include\s*[<"]/.test(first100Lines) && 
        !/\b(printf|scanf|malloc|free|sizeof|std::|cout|cin)\b/.test(first100Lines)) {
      return null;
    }
  }
  
  // Exclude Dart files - check for Dart imports
  if (/\b(import\s+['"]dart:|import\s+['"]package:|part\s+of\s+['"]|part\s+['"])\b/.test(first100Lines)) {
    return null;
  }
  
  if (/#include\s*[<"]/.test(first100Lines) || /\b(printf|scanf|malloc|free|sizeof|NULL)\b/.test(first100Lines)) {
    // Check for C++ specific features (but not <string.h> which is C)
    if (/\b(std::|cout|cin|vector|template|class|namespace|new\s+\w+|delete\s+\w+|using\s+namespace)\b/.test(first100Lines) ||
        (/\bstring\b/.test(first100Lines) && !/<string\.h>/.test(first100Lines))) {
      return 'cpp';
    }
    if (/\b(printf|scanf|struct\s+\w+|typedef)\b/.test(first100Lines) && !hasDoubleColon && !sample.includes('class')) {
      return 'c';
    }
    if (/#include\s*<\w+\.h>/.test(first100Lines) && !sample.includes('std::') && !sample.includes('class')) {
      return 'c';
    }
    // Check for typedef struct/enum (common in C headers)
    if (/\btypedef\s+(struct|enum)\b/.test(first100Lines) && !hasDoubleColon && !sample.includes('class') && !sample.includes('template')) {
      return 'c';
    }
    // If has #include but no C++ features, likely C (especially for .h headers)
    if (!hasDoubleColon && !sample.includes('class') && !sample.includes('template') && !sample.includes('namespace')) {
      return 'c';
    }
    return 'cpp';
  }
  
  if (/\b(struct|typedef|enum)\s+\w+/.test(first100Lines) && /\b(int|char|float|double|void)\s+\w+/.test(first100Lines)) {
    if (sample.includes('::') || sample.includes('class') || sample.includes('template')) {
      return 'cpp';
    }
    return 'c';
  }
  
  // Only detect C++ class if it's not JavaScript
  if (/\b(protected|private|public)\s*:/.test(first100Lines) && hasClass) {
    // Make sure it's not JavaScript class with alert/super
    if (!sample.includes('alert(') && !sample.includes('super.')) {
      return 'cpp';
    }
  }
  
  return null;
};

// ===== Java Detector =====
const detectJava = (ctx) => {
  const { first100Lines, sample } = ctx;
  
  // Strong Java indicators - package and import statements
  if (/^package\s+[\w.]+;/m.test(first100Lines) || /^import\s+java\./m.test(first100Lines)) {
    return 'java';
  }
  
  // Java-specific imports
  if (/^import\s+(org\.(apache|jooq|intellij|junit)|com\.intellij)\./m.test(first100Lines)) {
    return 'java';
  }
  
  // Java class declarations with modifiers
  if (/\b(public|private|protected)\s+(static\s+)?(class|interface|enum)\s+\w+/.test(first100Lines)) {
    if (/\b(public\s+static\s+void\s+main|System\.out\.|@Override|@SuppressWarnings|extends\s+\w+|implements\s+\w+)\b/.test(first100Lines)) {
      return 'java';
    }
  }
  
  return null;
};

// ===== Go Detector =====
const detectGo = (ctx) => {
  const { first100Lines, sample } = ctx;
  
  // Must have package declaration
  if (!/^package\s+\w+$/m.test(first100Lines)) {
    return null;
  }
  
  // Strong Go indicators
  if (/\b(func\s+\w+|type\s+\w+\s+struct|type\s+\w+\s+interface)\b/.test(first100Lines)) {
    if (/\b(chan|go\s+func|defer|interface\s*\{|make\(|range\s+)\b/.test(first100Lines) || 
        sample.includes(':=') ||
        /`json:"/.test(first100Lines) ||
        /\bfunc\s+init\s*\(\)/.test(first100Lines)) {
      return 'go';
    }
  }
  
  // Package + any Go-specific syntax
  if (sample.includes(':=') || 
      /`\w+:"/.test(first100Lines) ||
      /\b(chan|defer|goroutine)\b/.test(first100Lines)) {
    return 'go';
  }
  
  return null;
};

// ===== Rust Detector =====
const detectRust = (ctx) => {
  const { first100Lines, sample, hasDoubleColon, hasArrow } = ctx;
  
  // Strong Rust indicators
  if (/\b(fn\s+main|pub\s+fn|impl\s+\w+|use\s+std::|use\s+self::|extern\s+crate)\b/.test(first100Lines)) {
    return 'rust';
  }
  
  // Rust-specific patterns
  if (!/\b(fn\s+\w+|let\s+mut|impl\s+|struct\s+\w+|enum\s+\w+|pub\s+|use\s+\w+::)\b/.test(first100Lines)) {
    return null;
  }
  
  const rustScore = (
    (hasDoubleColon ? 2 : 0) +
    (hasArrow ? 1 : 0) +
    (/\|[\w,\s]+\|/.test(first100Lines) ? 2 : 0) +
    (sample.includes('&str') || sample.includes('&mut') ? 2 : 0) +
    (/\b(Some\(|None\b|Ok\(|Err\(|Result<|Option<)\b/.test(first100Lines) ? 2 : 0) +
    (/\b(let\s+mut|pub\s+fn|impl\s+|use\s+\w+::)\b/.test(first100Lines) ? 2 : 0) +
    (sample.includes('println!') || sample.includes('vec!') || sample.includes('macro_rules!') ? 2 : 0)
  );
  
  if (rustScore >= 4) {
    return 'rust';
  }
  
  return null;
};

// ===== JavaScript/TypeScript Detector =====
const detectJavaScript = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces, hasSemicolon, hasImport, hasConst, hasLet, hasFunction } = ctx;
  
  // Exclude if it's clearly another language
  if (sample.includes('<?php') || 
      sample.includes('#include <') ||
      /^package\s+\w+;/m.test(first100Lines) ||
      /\b(public\s+class|private\s+class|protected\s+class)\b/.test(first100Lines) ||
      /\b(fn\s+main|let\s+mut|impl\s+|pub\s+fn)\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Markdown files with YAML frontmatter
  if (/^---\s*$/.test(firstLine) && /^#{1,6}\s+/m.test(first100Lines)) {
    return null;
  }
  
  // Strong TypeScript indicators - must check before JSX
  // Remove ALL comments more aggressively (handle multi-line comments that span many lines)
  let codeWithoutComments = first100Lines;
  // Remove multi-line comments (may span multiple lines)
  while (/\/\*[\s\S]*?\*\//.test(codeWithoutComments)) {
    codeWithoutComments = codeWithoutComments.replace(/\/\*[\s\S]*?\*\//g, ' ');
  }
  // Remove single-line comments
  codeWithoutComments = codeWithoutComments.replace(/\/\/.*/g, '');
  
  // TypeScript type annotations (but not in object literals)
  // Check for parameter types: constructor(public name: string) or function(param: type)
  if (/\bconstructor\s*\(\s*(public|private|protected)\s+\w+\s*\)/.test(codeWithoutComments)) {
    return 'typescript';
  }
  
  // Function parameter type annotations: function name(param: type) or (param: type) =>
  if (/\bfunction\s+\w+\s*\([^)]*:\s*(string|number|boolean|any|void|Promise|Array)/.test(codeWithoutComments)) {
    return 'typescript';
  }
  
  // Arrow function or regular function with parameter types
  if (/\(\s*\w+:\s*(string|number|boolean|any|void|Promise|Array)[^)]*\)\s*(:|=>)/.test(codeWithoutComments)) {
    return 'typescript';
  }
  
  // Strong TypeScript indicators (need at least 2 matches to be confident)
  const tsIndicators = [
    /\binterface\s+\w+\s*\{/.test(codeWithoutComments),
    /\btype\s+\w+\s*=/.test(codeWithoutComments),
    /\babstract\s+class\b/.test(codeWithoutComments),
    /\bimplements\s+\w+/.test(codeWithoutComments),
    /\b(public|private|protected)\s+(readonly\s+)?\w+:\s*\w+/.test(codeWithoutComments),
    /<T>|<T,/.test(codeWithoutComments),
    /:\s*(Promise<|Array<)/.test(codeWithoutComments)
  ].filter(Boolean).length;
  
  if (tsIndicators >= 2) {
    return 'typescript';
  }
  
  // Check for JSX/TSX
  if (/<[A-Z]\w+/.test(first100Lines) || /return\s*\(?\s*<[a-z]+/.test(first100Lines)) {
    if (tsIndicators >= 1 || sample.includes('interface ')) {
      return 'tsx';
    }
    return 'jsx';
  }
  
  // Simple browser/Node.js API calls
  if (/\b(console\.(log|error|warn|info)|alert|document\.|window\.|require\(|module\.exports)\b/.test(first100Lines)) {
    // Very simple files with just console.log might be TypeScript (TypeScript is a superset of JavaScript)
    if (ctx.lines.length <= 3 && /^console\.log\(/.test(first100Lines.trim())) {
      return 'typescript';
    }
    return 'javascript';
  }
  
  // Check for JavaScript - need at least some JS features
  if (!hasCurlyBraces && !hasSemicolon && !hasImport && !hasConst && !hasLet && !hasFunction) {
    return null;
  }
  
  const jsScore = (
    (hasImport && /^import\s+/.test(firstLine) ? 2 : 0) +
    ((hasConst || hasLet) ? 1 : 0) +
    (hasFunction || /=>\s*\{/.test(first100Lines) || /function\s+\w+\s*\(/.test(first100Lines) ? 2 : 0) +
    (/\b(console\.|document\.|window\.|require\(|module\.exports|exports\.|async\s+function|await\s+|Object\.|Array\.|alert\()\b/.test(first100Lines) ? 2 : 0) +
    (hasCurlyBraces && hasSemicolon ? 1 : 0) +
    (/\bvar\s+\w+\s*=/.test(first100Lines) ? 1 : 0)
  );
  
  if (jsScore >= 3) {
    return 'javascript';
  }
  
  return null;
};

// ===== Ruby Detector =====
const detectRuby = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces } = ctx;
  
  // Exclude TypeScript/JavaScript files first
  if (/\b(import\s+.*from|export\s+(default|const|function)|interface\s+\w+|abstract\s+class)\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Scala files - check for Scala-specific patterns
  // Check for def with parameter types: def name(param: Type)
  if (/\bdef\s+\w+\s*\([^)]*:\s*\w+/.test(first100Lines)) {
    return null;
  }
  
  if (/\b(import\s+scala\.|object\s+\w+\s+extends|case\s+class|val\s+\w+\s*:\s*\w+|var\s+\w+\s*:\s*\w+)\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Scala build files - check for := operator
  if (/\b(name|version|organization|libraryDependencies)\s*:=/.test(first100Lines)) {
    return null;
  }
  
  // Ruby encoding comment
  if (firstLine.startsWith('# encoding:') || firstLine.startsWith('# frozen_string_literal:') || firstLine.startsWith('# typed:')) {
    return 'ruby';
  }
  
  // Ruby require statements (with or without quotes)
  if (/^require\s+/.test(first100Lines) || /^require_relative\s+/.test(first100Lines)) {
    if (/\b(module\s+\w+|class\s+\w+|def\s+\w+|end\b|attr_reader|attr_accessor|attr_writer)\b/.test(first100Lines)) {
      return 'ruby';
    }
  }
  
  // Ruby RSpec/testing patterns
  if (/\b(describe|context|it|before|after)\s+['"]/.test(first100Lines) || /\b(describe|context)\s+\w+\s+do\b/.test(first100Lines)) {
    if (/\.should\b|expect\(/.test(first100Lines) || /\bdo\b/.test(first100Lines)) {
      return 'ruby';
    }
  }
  
  // Ruby type signatures (Sorbet) - .rbi files
  if (/\bsig\s*\{/.test(first100Lines)) {
    if (/\b(params|returns|void)\s*\(/.test(first100Lines) || /\bT\.(untyped|nilable)/.test(first100Lines)) {
      return 'ruby';
    }
  }
  
  // Simple Ruby files - just module/class with end
  if (/^module\s+\w+\s*$/m.test(first100Lines) || /^class\s+\w+\s*$/m.test(first100Lines)) {
    if (sample.includes('end')) {
      return 'ruby';
    }
  }
  
  // Ruby attr_* declarations
  if (/\b(attr_reader|attr_accessor|attr_writer)\s+:/.test(first100Lines)) {
    return 'ruby';
  }
  
  // Strong Ruby indicators - must have 'end' keyword
  if (/\b(def\s+\w+|class\s+\w+\s*<|module\s+\w+|attr_accessor|attr_reader|attr_writer)\b/.test(first100Lines)) {
    if (sample.includes('end') && 
        (/\b(puts|print|gets|chomp|each|map|select|reject|nil\?|empty\?|require|include\s+\w+)\b/.test(first100Lines) ||
         /@\w+/.test(first100Lines))) {
      return 'ruby';
    }
  }
  
  // Ruby-specific patterns - must have 'end'
  if (!hasCurlyBraces && /\b(def|elsif|unless)\b/.test(first100Lines) && sample.includes('end')) {
    return 'ruby';
  }
  
  return null;
};

// ===== C# Detector =====
const detectCSharp = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces, hasSemicolon } = ctx;
  
  // Exclude Markdown files with YAML frontmatter
  if (firstLine.trim() === '---') {
    return null;
  }
  
  // Exclude Java files
  if (/^package\s+[\w.]+;/m.test(first100Lines) || /^import\s+(java|org|com)\./m.test(first100Lines)) {
    return null;
  }
  
  // Exclude Dart files - check for Dart imports
  if (/\b(import\s+['"]dart:|import\s+['"]package:|part\s+of\s+|part\s+['"])\b/.test(first100Lines)) {
    return null;
  }
  
  // LINQPad files - XML header with C# code
  if (firstLine.includes('<Query Kind="Program">') || firstLine.includes('<Query Kind="Expression">')) {
    if (/\bvoid\s+Main\s*\(/.test(first100Lines) || /\b(using\s+System|namespace\s+\w+)\b/.test(first100Lines)) {
      return 'csharp';
    }
  }
  
  // Strong C# indicators - using System (must be at line start)
  if (/^using\s+System/m.test(first100Lines)) {
    return 'csharp';
  }
  
  // C# namespace declaration
  if (/^namespace\s+[\w.]+[;\s]*$/m.test(first100Lines)) {
    return 'csharp';
  }
  
  // Cake build scripts (.cake files) - C# DSL
  if (/\b(Task|Argument|Setup|Teardown|GetFiles|Select)\s*\(/.test(first100Lines)) {
    if (/var\s+\w+\s*=\s*Argument</.test(first100Lines) || 
        /\.Select\s*\(/.test(first100Lines) ||
        /Setup\s*\(\s*\(\s*\)\s*=>/.test(first100Lines)) {
      return 'csharp';
    }
  }
  
  if (!hasCurlyBraces || !hasSemicolon) {
    return null;
  }
  
  // C# specific patterns
  if (/\b(public\s+class|private\s+class|internal\s+class)\b/.test(first100Lines)) {
    if (sample.includes('Console.WriteLine') ||
        sample.includes('Console.Write') ||
        /\b(var\s+\w+\s*=|string\s+\w+|void\s+Main|async\s+Task|await\s+)\b/.test(first100Lines)) {
      return 'csharp';
    }
  }
  
  // C# properties and LINQ
  if (/\b(get;\s*set;|=>|IEnumerable|List<|Dictionary<)\b/.test(first100Lines)) {
    return 'csharp';
  }
  
  return null;
};

// ===== Shell Detector =====
const detectShell = (ctx) => {
  const { first100Lines, firstLine, lines } = ctx;
  
  // Shell set commands at the start
  if (/^set\s+-[euxo]/.test(firstLine)) {
    return 'bash';
  }
  
  // Incomplete shebang (#!/usr/bin/env without interpreter) + shell commands
  if (/^#!\/usr\/bin\/env\s*$/m.test(firstLine)) {
    if (/\b(echo|export|source|cd|ls|grep|awk|sed)\b/.test(first100Lines)) {
      return 'bash';
    }
  }
  
  // Shell-specific patterns
  if (/\b(echo|export|source|alias|cd|ls|grep|awk|sed|chmod|chown)\b/.test(first100Lines)) {
    const shellScore = (
      (/\$\{?\w+\}?/.test(first100Lines) ? 2 : 0) +
      (/\b(if\s+\[|then|fi|elif|else|case|esac|for\s+\w+\s+in|while|do|done)\b/.test(first100Lines) ? 2 : 0) +
      (lines.slice(0, 20).filter(l => l.trim().startsWith('#') && !l.includes('include')).length > 2 ? 1 : 0) +
      (/\|\s*\w+|\w+\s*\|/.test(first100Lines) ? 1 : 0) +
      (/^(echo|cd|make|cmake)\s+/m.test(first100Lines) ? 1 : 0)
    );
    
    if (shellScore >= 3) {
      return 'bash';
    }
  }
  
  return null;
};

// ===== SQL Detector =====
const detectSQL = (ctx) => {
  const { first100Lines, sample } = ctx;
  
  // Exclude Markdown files (has # headers and no SQL keywords)
  if (/^#{1,6}\s+\w+/m.test(first100Lines)) {
    // If it has Markdown headers, it's probably Markdown unless it has strong SQL patterns
    if (!/\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|CREATE\s+TABLE|DROP\s+TABLE)\b/i.test(first100Lines)) {
      return null;
    }
  }
  
  // Strong SQL keywords
  const hasStrongKeywords = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE\s+(TABLE|PROCEDURE|FUNCTION|VIEW|INDEX)|DROP\s+(TABLE|PROCEDURE|FUNCTION|VIEW)|ALTER\s+TABLE|GRANT|SHOW\s+WARNINGS)\b/i.test(first100Lines);
  
  if (!hasStrongKeywords) {
    return null;
  }
  
  // SQL-specific patterns
  const sqlScore = (
    (/\b(SELECT\s+.*\s+FROM|INSERT\s+INTO|UPDATE\s+.*\s+SET|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(first100Lines) ? 3 : 0) +
    (/\b(DROP\s+(TABLE|PROCEDURE|FUNCTION|VIEW|TYPE)|ALTER\s+TABLE)\b/i.test(first100Lines) ? 3 : 0) +
    (/\b(WHERE|JOIN|GROUP\s+BY|ORDER\s+BY|HAVING|PRIMARY\s+KEY|FOREIGN\s+KEY)\b/i.test(first100Lines) ? 2 : 0) +
    (/\b(VARCHAR|INT|INTEGER|BIGINT|DECIMAL|DATETIME|TIMESTAMP|NOT\s+NULL|AUTO_INCREMENT)\b/i.test(first100Lines) ? 2 : 0) +
    (/;[\s\n]*$/m.test(first100Lines) ? 1 : 0) +
    (/--\s+/.test(first100Lines) ? 1 : 0)
  );
  
  if (sqlScore >= 3) {
    return 'sql';
  }
  
  return null;
};

// ===== HTML Detector =====
const detectHTML = (ctx) => {
  const { sample, first100Lines } = ctx;
  
  // Exclude if it's clearly another language
  if (/^using\s+System/m.test(first100Lines) ||
      /^package\s+\w+/m.test(first100Lines) ||
      sample.includes('<?php')) {
    return null;
  }
  
  // Exclude SQL files (may have HTML in string literals)
  if (/\b(CREATE\s+TABLE|INSERT\s+INTO|SELECT\s+.*\s+FROM|DROP\s+TABLE|SHOW\s+WARNINGS)\b/i.test(first100Lines)) {
    return null;
  }
  
  // HTML doctype or common tags
  if (/<!DOCTYPE\s+html>/i.test(first100Lines) ||
      /<html[\s>]/i.test(first100Lines) ||
      /<head[\s>]/i.test(first100Lines) ||
      /<body[\s>]/i.test(first100Lines)) {
    return 'html';
  }
  
  // HTML script tag (including special types like Hoplon)
  if (/<script[\s>]/i.test(first100Lines)) {
    return 'html';
  }
  
  // HTML closing tags (for fragments)
  if (/^<\/(html|head|body|div|ul|ol|table|form)>/im.test(first100Lines)) {
    return 'html';
  }
  
  // HTML tags - but need multiple to be confident
  const htmlTagMatches = first100Lines.match(/<(div|span|p|a|img|table|form|input|button|h[1-6]|ul|ol|li)[\s>]/gi);
  if (htmlTagMatches && htmlTagMatches.length >= 3) {
    return 'html';
  }
  
  return null;
};

// ===== Markdown Detector =====
const detectMarkdown = (ctx) => {
  const { first100Lines, lines, sample, firstLine } = ctx;
  
  // Exclude if it's clearly code with strong indicators
  if (/^using\s+System/m.test(first100Lines) ||
      /^package\s+\w+;/m.test(first100Lines) ||
      sample.includes('<?php') ||
      /\b(function\s+\w+\s*\(|def\s+\w+|impl\s+\w+)\b/.test(first100Lines)) {
    return null;
  }
  
  // YAML frontmatter + Markdown content (like .workbook files)
  if (/^---\s*$/.test(firstLine)) {
    if (/^#{1,6}\s+/m.test(first100Lines) || /\[.*\]\(.*\)/.test(first100Lines) || /^[-*+]\s+/m.test(first100Lines)) {
      return 'markdown';
    }
  }
  
  // Markdown patterns
  const mdScore = (
    (lines.slice(0, 20).filter(l => /^#{1,6}\s+/.test(l)).length > 0 ? 2 : 0) +
    (/^[-*+]\s+/.test(first100Lines) ? 1 : 0) +
    (/\[.*\]\(.*\)/.test(first100Lines) ? 1 : 0) +
    (/^>\s+/.test(first100Lines) ? 1 : 0) +
    (/```/.test(first100Lines) ? 1 : 0) +
    (/^[=\-]{3,}$/m.test(first100Lines) ? 1 : 0) +  // Setext headers
    (/^\*\*.*\*\*|^_.*_|^\*.*\*/.test(first100Lines) ? 1 : 0)  // Bold/italic
  );
  
  if (mdScore >= 2) {
    return 'markdown';
  }
  
  // Very simple markdown - just text with basic formatting or just a filename
  if (lines.length <= 3) {
    if (/\*\*|\*|_|`/.test(sample) || /^[A-Z]/.test(sample) || /^[a-z]+\.(md|markdown)$/i.test(sample.trim())) {
      return 'markdown';
    }
  }
  
  return null;
};

// ===== CSS Detector =====
const detectCSS = (ctx) => {
  const { first100Lines, sample, hasCurlyBraces } = ctx;
  
  if (!hasCurlyBraces) {
    return null;
  }
  
  // CSS selectors and properties
  if (/[.#][\w-]+\s*\{/.test(first100Lines) || 
      /^[\w-]+\s*\{/.test(first100Lines) ||
      /@(media|import|keyframes|font-face)/.test(first100Lines)) {
    
    // Check for common CSS properties
    if (/\b(color|background|margin|padding|border|width|height|display|position|font-size|font-family):\s*[^;]+;/.test(first100Lines)) {
      return 'css';
    }
    
    // Check for CSS units
    if (/\d+(px|em|rem|%|vh|vw|pt|cm|mm|in)\b/.test(first100Lines)) {
      return 'css';
    }
    
    // Check for CSS color values
    if (/#[0-9a-fA-F]{3,6}\b|rgb\(|rgba\(|hsl\(|hsla\(/.test(first100Lines)) {
      return 'css';
    }
  }
  
  // SCSS/SASS specific patterns
  if (/\$[\w-]+:\s*[^;]+;/.test(first100Lines) || 
      /@mixin|@include|@extend/.test(first100Lines)) {
    return 'scss';
  }
  
  return null;
};

// ===== Kotlin Detector =====
const detectKotlin = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, hasSemicolon } = ctx;
  
  if (!hasCurlyBraces) {
    return null;
  }
  
  // Exclude Go files (Go has package but different syntax)
  if (/^package\s+\w+$/m.test(first100Lines) && /\bfunc\s+\w+/.test(first100Lines)) {
    return null;
  }
  
  // Strong Kotlin indicators - package with import
  if (/^package\s+[\w.]+$/m.test(first100Lines) && /^import\s+[\w.]+/.test(first100Lines)) {
    if (/\b(fun\s+\w+|val\s+\w+|var\s+\w+:\s*\w+|class\s+\w+|object\s+\w+|interface\s+\w+|data\s+class)\b/.test(first100Lines)) {
      return 'kotlin';
    }
  }
  
  // Kotlin-specific patterns
  if (/\b(fun\s+\w+|data\s+class|sealed\s+class|companion\s+object)\b/.test(first100Lines)) {
    if (sample.includes('?.') ||
        sample.includes('!!') ||
        /\b(suspend|inline|reified|when\s*\{)\b/.test(first100Lines) ||
        !hasSemicolon) {
      return 'kotlin';
    }
  }
  
  return null;
};

// ===== Swift Detector =====
const detectSwift = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces } = ctx;
  
  // Strong Swift indicators
  if (/\b(import\s+Foundation|import\s+UIKit|import\s+SwiftUI)\b/.test(first100Lines)) {
    return 'swift';
  }
  
  // Swift-specific patterns - more relaxed
  if (/\b(func\s+\w+|var\s+\w+:\s*\w+|let\s+\w+:\s*\w+|class\s+\w+:\s*\w+|struct\s+\w+|enum\s+\w+|protocol\s+\w+)\b/.test(first100Lines)) {
    if (sample.includes('->') ||
        /\b(guard|defer|mutating|inout|@\w+|extension\s+\w+)\b/.test(first100Lines) ||
        /\?\?|\?\./.test(first100Lines)) {
      return 'swift';
    }
  }
  
  // Swift string interpolation: \(variable) - doesn't need curly braces
  if (/\\\([\w\s+]+\)/.test(first100Lines)) {
    return 'swift';
  }
  
  // Swift optional binding: if let / var
  if (/\b(if|guard)\s+let\s+\w+/.test(first100Lines)) {
    return 'swift';
  }
  
  // Swift array/dictionary literals with type annotations
  // let/var name = Type[]() or Dictionary<Type, Type>()
  if (/\b(let|var)\s+\w+\s*=\s*\w+\[\]\(\)/.test(first100Lines)) {
    return 'swift';
  }
  
  if (/\b(let|var)\s+\w+\s*=\s*Dictionary</.test(first100Lines)) {
    return 'swift';
  }
  
  // Swift array/dictionary literals - simple assignment
  // var name = ["item1", "item2"] or ["key": "value"]
  if (/\b(var|let)\s+\w+\s*=\s*\[/.test(first100Lines)) {
    // Check if it's a dictionary (has "key": "value" pattern)
    if (/\[[\s\n]*"[^"]+"\s*:\s*"[^"]+"\s*[,\]]/.test(first100Lines)) {
      return 'swift';
    }
    // Check if it's an array with multiple elements
    if (/\[[\s\n]*"[^"]+"\s*,/.test(first100Lines)) {
      return 'swift';
    }
  }
  
  // Swift simple array assignment without var/let (e.g., "shoppingList = []")
  // This is a very weak signal, but if the file is very short and has this pattern, it's likely Swift
  if (ctx.lines.length <= 3 && /^\w+\s*=\s*\[\s*\]/.test(first100Lines.trim())) {
    return 'swift';
  }
  
  // Swift without strong type annotations - check for Swift-specific syntax
  if (hasCurlyBraces) {
    // Swift for-in loop
    if (/\bfor\s+\w+\s+in\s+/.test(first100Lines)) {
      if (/\b(let|var)\s+\w+\s*=/.test(first100Lines)) {
        return 'swift';
      }
    }
    
    // Swift switch with case
    if (/\bswitch\s+\w+\s*\{/.test(first100Lines) && /\bcase\s+/.test(first100Lines)) {
      return 'swift';
    }
    
    // Swift do-while
    if (/\bdo\s*\{/.test(first100Lines) && /\}\s*while\s+/.test(first100Lines)) {
      return 'swift';
    }
  }
  
  return null;
};

// ===== Dart Detector =====
const detectDart = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, hasSemicolon } = ctx;
  
  // Strong Dart indicators - import 'dart:' or 'package:' (highest priority)
  if (/\b(import\s+['"]dart:|import\s+['"]package:)\b/.test(first100Lines)) {
    return 'dart';
  }
  
  // Dart part directive - part of 'file.dart';
  if (/\b(library\s+\w+;|part\s+of\s+['"]|part\s+['"])\b/.test(first100Lines)) {
    return 'dart';
  }
  
  // Dart-specific patterns - @dart annotation or // dart format
  if (/@dart\s*=/.test(first100Lines) || /\/\/\s*dart\s+format/.test(first100Lines)) {
    return 'dart';
  }
  
  if (!hasCurlyBraces || !hasSemicolon) {
    return null;
  }
  
  // Exclude TypeScript/JavaScript files
  if (/\b(import\s+.*from|export\s+(default|const|function)|console\.|alert\()\b/.test(first100Lines)) {
    return null;
  }
  
  // Dart class with extends
  if (/\bclass\s+\w+\s+extends\s+\$\w+/.test(first100Lines)) {
    return 'dart';
  }
  
  // Dart-specific patterns - need strong evidence
  if (/\b(void\s+main|@override)\b/i.test(first100Lines)) {
    if (/\b(Future<|Stream<|final\s+\w+|const\s+\w+|dynamic\s+\w+)\b/.test(first100Lines)) {
      return 'dart';
    }
  }
  
  return null;
};

// ===== Scala Detector =====
const detectScala = (ctx) => {
  const { sample, first100Lines, hasCurlyBraces, firstLine, lines } = ctx;
  
  // Exclude JavaScript/TypeScript files
  if (/\b(var\s+\w+\s*=|function\s+\w+|console\.|document\.|window\.|require\(|module\.exports|alert\(|constructor\s*\()\b/.test(first100Lines)) {
    return null;
  }
  
  // Exclude Go files (Go has package but different syntax)
  if (/^package\s+\w+$/m.test(first100Lines) && /\b(func\s+\w+|import\s+\()\b/.test(first100Lines)) {
    return null;
  }
  
  // Scala shebang scripts - already handled by checkShebang
  // But keep this as fallback
  if (firstLine.includes('exec scala')) {
    return 'scala';
  }
  
  // Strong Scala indicators - import scala.* or scala.language.*
  if (/\b(import\s+scala\.|import\s+math\.|package\s+object)\b/.test(first100Lines)) {
    return 'scala';
  }
  
  // Scala build files (.sbt) - check for := operator with common sbt keywords
  if (/\b(name|version|organization|libraryDependencies)\s*:=/.test(first100Lines)) {
    return 'scala';
  }
  
  // Scala-specific patterns - need strong evidence
  if (hasCurlyBraces) {
    // Scala object/trait/case class
    if (/\b(object\s+\w+\s+(extends|with)|trait\s+\w+|case\s+class)\b/.test(first100Lines)) {
      return 'scala';
    }
    
    // Scala def with type annotation
    if (/\bdef\s+\w+\s*(\(.*\))?\s*:\s*\w+/.test(first100Lines)) {
      return 'scala';
    }
    
    // Scala val/var with type annotation
    if (/\b(val|var)\s+\w+\s*:\s*\w+/.test(first100Lines)) {
      if (sample.includes('<-') ||
          /\b(extends|with|implicit|sealed|match\s*\{)\b/.test(first100Lines)) {
        return 'scala';
      }
    }
    
    // Scala without type annotations but with Scala-specific patterns
    // Check for val/var/def + Scala collections or other Scala features
    if (/\b(val|var|def)\s+\w+/.test(first100Lines)) {
      if (/\b(collection\.(mutable|immutable)|Vector2D|PicShape|Picture\{)\b/.test(first100Lines) ||
          /\b(repeat|forward|right|draw|trans)\s*\(/.test(first100Lines)) {
        return 'scala';
      }
    }
  }
  
  // Scala worksheet files (.sc) - import scala.* without package
  if (/^import\s+(scala|math)\./m.test(first100Lines)) {
    if (/\b(object\s+\w+|def\s+\w+|val\s+\w+|println\()\b/.test(first100Lines)) {
      return 'scala';
    }
  }
  
  return null;
};

// ===== Main detection function =====
const detectors = [
  { name: 'shebang', priority: 1, detector: checkShebang },
  { name: 'php', priority: 2, detector: detectPHP },
  { name: 'dart', priority: 3, detector: detectDart },
  { name: 'csharp', priority: 4, detector: detectCSharp },
  { name: 'html', priority: 5, detector: detectHTML },
  { name: 'python', priority: 6, detector: detectPython },
  { name: 'ruby', priority: 7, detector: detectRuby },
  { name: 'css', priority: 8, detector: detectCSS },
  { name: 'rust', priority: 9, detector: detectRust },
  { name: 'sql', priority: 10, detector: detectSQL },
  { name: 'java', priority: 11, detector: detectJava },
  { name: 'scala', priority: 12, detector: detectScala },
  { name: 'cpp', priority: 13, detector: detectCPP },
  { name: 'kotlin', priority: 14, detector: detectKotlin },
  { name: 'go', priority: 15, detector: detectGo },
  { name: 'swift', priority: 16, detector: detectSwift },
  { name: 'javascript', priority: 17, detector: detectJavaScript },
  { name: 'shell', priority: 18, detector: detectShell },
  { name: 'markdown', priority: 19, detector: detectMarkdown },
];

function guessLanguage(code) {
  if (!code || !code.trim()) return null;
  
  const ctx = createContext(code);
  
  const sortedDetectors = detectors.sort((a, b) => a.priority - b.priority);
  
  for (const { detector } of sortedDetectors) {
    const result = detector(ctx);
    if (result) return result;
  }
  
  return null;
}

// ===== Test runner =====
const top20Languages = {
    'JavaScript': 'javascript',
    'Python': 'python',
    'Java': 'java',
    'TypeScript': 'typescript',
    'C#': 'csharp',
    'C++': 'cpp',
    'PHP': 'php',
    'C': 'c',
    'Shell': 'bash',
    'Ruby': 'ruby',
    'Go': 'go',
    'Rust': 'rust',
    'Kotlin': 'kotlin',
    'Swift': 'swift',
    'Dart': 'dart',
    'Scala': 'scala',
    'SQL': 'sql',
    'HTML': 'html',
    'CSS': 'css',
    'Markdown': 'markdown',
};

const samplesDir = '.reference/linguist/samples';

console.log('🎯 Testing Modular Language Detection\n');
console.log('='.repeat(80) + '\n');

let totalTests = 0;
let passed = 0;

Object.keys(top20Languages).forEach((langDir) => {
    const expectedLang = top20Languages[langDir];
    const langPath = path.join(samplesDir, langDir);
    
    if (!fs.existsSync(langPath)) return;

    let files;
    try {
        files = fs.readdirSync(langPath, { withFileTypes: true })
            .filter(dirent => dirent.isFile())
            .map(dirent => dirent.name)
            .filter(name => !name.startsWith('.'))
            .slice(0, 5);
    } catch (err) {
        return;
    }

    if (files.length === 0) return;

    let langPassed = 0;
    let langTotal = 0;

    files.forEach(file => {
        const filePath = path.join(langPath, file);
        let code;
        
        try {
            code = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            return;
        }

        if (!code || code.length === 0 || code.length > 200000) return;

        totalTests++;
        langTotal++;

        const detected = guessLanguage(code);
        
        if (detected === expectedLang) {
            passed++;
            langPassed++;
        }
    });
    
    if (langTotal > 0) {
        const passRate = ((langPassed / langTotal) * 100).toFixed(1);
        const status = passRate >= 80 ? '✅' : passRate >= 60 ? '⚠️' : '❌';
        console.log(`${status} ${langDir.padEnd(20)} ${langPassed}/${langTotal} (${passRate}%)`);
    }
});

console.log('\n' + '='.repeat(80));
console.log(`\n📈 Overall: ${passed}/${totalTests} passed (${((passed / totalTests) * 100).toFixed(2)}%)\n`);
