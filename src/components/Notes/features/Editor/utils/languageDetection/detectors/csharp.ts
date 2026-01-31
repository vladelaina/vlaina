import type { LanguageDetector } from '../types';

export const detectCSharp: LanguageDetector = (ctx) => {
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
