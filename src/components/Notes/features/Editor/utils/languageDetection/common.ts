import type { DetectionContext, LanguageDetector } from './types';

export function createContext(code: string): DetectionContext {
  const lines = code.split('\n');
  const firstLine = lines[0] || '';
  const first100Lines = lines.slice(0, 100).join('\n');
  const sample = code.slice(0, 1000);
  
  return {
    code,
    sample,
    firstLine,
    first100Lines,
    lines,
    hasCurlyBraces: code.includes('{') || code.includes('}'),
    hasSemicolon: code.includes(';'),
    hasImport: /\bimport\s+/.test(first100Lines),
    hasConst: /\bconst\s+/.test(first100Lines),
    hasLet: /\blet\s+/.test(first100Lines),
    hasFunction: /\bfunction\s+/.test(first100Lines),
  };
}

export const checkShebang: LanguageDetector = (ctx) => {
  const { firstLine } = ctx;
  
  if (!firstLine.startsWith('#!')) {
    return null;
  }
  
  const shebangMap: Record<string, string> = {
    'python': 'python',
    'python2': 'python',
    'python3': 'python',
    'node': 'javascript',
    'bash': 'shell',
    'sh': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'ruby': 'ruby',
    'perl': 'perl',
    'php': 'php',
    'lua': 'lua',
    'crystal': 'crystal',
    'pwsh': 'powershell',
    'powershell': 'powershell',
  };
  
  for (const [key, lang] of Object.entries(shebangMap)) {
    if (firstLine.includes(key)) {
      return lang;
    }
  }
  
  return null;
};
