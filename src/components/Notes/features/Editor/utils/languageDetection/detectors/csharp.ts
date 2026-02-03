import type { LanguageDetector } from '../types';

export const detectCSharp: LanguageDetector = (ctx) => {
  const { sample, first100Lines, firstLine, hasCurlyBraces, hasSemicolon } = ctx;

  if (/#import\s+["<]/.test(first100Lines) ||
      /@(interface|implementation|property|protocol)\b/.test(first100Lines) ||
      /\bNS[A-Z]\w+\s*\*/.test(first100Lines)) {
    return null;
  }

  if (firstLine.trim() === '---') {
    return null;
  }

  if (/^namespace\s+[\w.]+$/m.test(first100Lines) && !/\{/.test(first100Lines.slice(0, 200))) {
    return null;
  }
  if (/^open\s+[A-Z][\w.]*$/m.test(first100Lines) || /\blet\s+\w+\s*=/.test(first100Lines)) {
    return null;
  }

  if (/^package\s+[\w.]+;/m.test(first100Lines) || /^import\s+(java|org|com)\./m.test(first100Lines)) {
    return null;
  }

  if (/\b(import\s+['"]dart:|import\s+['"]package:|part\s+of\s+|part\s+['"])\b/.test(first100Lines)) {
    return null;
  }

  if (firstLine.includes('<Query Kind=')) {
    return 'csharp';
  }

  if (/^using\s+System/m.test(first100Lines)) {
    return 'csharp';
  }

  if (/^namespace\s+[\w.]+\s*\{/m.test(first100Lines)) {
    return 'csharp';
  }

  if (/^namespace\s+[\w.]+;$/m.test(first100Lines)) {
    return 'csharp';
  }

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

  if (/\b(public\s+class|private\s+class|internal\s+class)\b/.test(first100Lines)) {
    if (sample.includes('Console.WriteLine') ||
        sample.includes('Console.Write') ||
        /\b(var\s+\w+\s*=|string\s+\w+|void\s+Main|async\s+Task|await\s+)\b/.test(first100Lines)) {
      return 'csharp';
    }
  }

  if (/\b(get;\s*set;|=>|IEnumerable|List<|Dictionary<)\b/.test(first100Lines)) {
    return 'csharp';
  }

  if (/\b(int|string|void|bool|double|float)\s+[A-Z]\w*\s*\([^)]*\)\s*\{/.test(first100Lines)) {

    if (!/^(package|import)\s+/m.test(first100Lines)) {

      if (!/#include\s*[<"]/.test(first100Lines) && !/std::/.test(first100Lines)) {
        return 'csharp';
      }
    }
  }

  return null;
};
