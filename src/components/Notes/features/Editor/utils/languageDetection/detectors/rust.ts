import type { LanguageDetector } from '../types';

export const detectRust: LanguageDetector = (ctx) => {
  const { first100Lines, sample, hasDoubleColon, hasArrow } = ctx;

  if (/^package\s+[\w:]+;/m.test(first100Lines) ||
      /^use\s+(strict|warnings|lib)\b/m.test(first100Lines)) {
    return null;
  }

  if (/@import\(["']/.test(first100Lines)) {
    return null;
  }

  if (/@[\w-]+\s*:/.test(first100Lines) && /\{[\s\S]*?\}/.test(first100Lines)) {
    return null;
  }

  if (/\b(fn\s+main|pub\s+fn|impl\s+\w+|use\s+std::|use\s+self::|extern\s+crate)\b/.test(first100Lines)) {
    return 'rust';
  }

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
