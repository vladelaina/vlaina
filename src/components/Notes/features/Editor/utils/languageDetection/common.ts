import type { DetectionContext } from './types';

export function createContext(code: string): DetectionContext {
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

export function checkShebang(ctx: DetectionContext): string | null {
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
