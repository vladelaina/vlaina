import type { DetectorConfig } from './types';
import { createContext, checkShebang } from './common';
import { detectPHP } from './detectors/php';
import { detectPython } from './detectors/python';
import { detectCPP } from './detectors/cpp';
import { detectJava } from './detectors/java';
import { detectGo } from './detectors/go';
import { detectRust } from './detectors/rust';
import { detectJavaScript } from './detectors/javascript';
import { detectRuby } from './detectors/ruby';
import { detectCSharp } from './detectors/csharp';
import { detectShell } from './detectors/shell';
import { detectSQL } from './detectors/sql';
import { detectHTML, detectMarkdown } from './detectors/markup';
import { detectCSS } from './detectors/css';
import { detectSwift } from './detectors/swift';
import { detectKotlin } from './detectors/kotlin';
import { detectDart } from './detectors/dart';
import { detectScala } from './detectors/scala';

const detectors: DetectorConfig[] = [
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

export function guessLanguage(code: string): string | null {
  console.log('[guessLanguage] Input code length:', code?.length);
  console.log('[guessLanguage] Input code preview:', code?.slice(0, 100));
  
  if (!code || !code.trim()) {
    console.log('[guessLanguage] Code is empty or whitespace only');
    return null;
  }
  
  const ctx = createContext(code);
  console.log('[guessLanguage] Context created:', {
    lines: ctx.lines.length,
    firstLine: ctx.firstLine,
    hasCurlyBraces: ctx.hasCurlyBraces,
    hasImport: ctx.hasImport,
    hasFunction: ctx.hasFunction
  });
  
  const sortedDetectors = detectors.sort((a, b) => a.priority - b.priority);
  
  for (const { name, detector } of sortedDetectors) {
    const result = detector(ctx);
    if (result) {
      console.log(`[guessLanguage] Detected by ${name}:`, result);
      return result;
    }
  }
  
  console.log('[guessLanguage] No language detected by any detector');
  return null;
}

export { createContext } from './common';
export type { DetectionContext, LanguageDetector } from './types';
