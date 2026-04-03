import type { LanguageDetector } from '../types';

export const detectRust: LanguageDetector = (ctx) => {
  const { first100Lines, sample, code } = ctx;
  
  // Helper variables
  const hasDoubleColon = sample.includes('::');
  const hasArrow = sample.includes('->');

  if (/^package\s+[\w:]+;/m.test(first100Lines) ||
      /^use\s+(strict|warnings|lib)\b/m.test(first100Lines)) {
    return null;
  }

  if (/\b(pub\s+fn|fn)\s+\w+\s*\([^)]*\)\s+[!A-Za-z_][\w!]*/.test(first100Lines) && !/->/.test(first100Lines)) {
    return null;
  }

  if (/@import\(["']/.test(first100Lines)) {
    return null;
  }

  if (/@[\w-]+\s*:/.test(first100Lines) && /\{[\s\S]*?\}/.test(first100Lines)) {
    return null;
  }

  // Rust lifetime parameters: fn longest<'a>(x: &'a str, y: &'a str) -> &'a str
  if (/<'[a-z]\w*>/.test(code) || /&'[a-z]\w*\s+\w+/.test(code)) {
    return 'rust';
  }

  if (/\bprintln!\(/.test(code)) {
    return 'rust';
  }

  if (/\b(let|const)\s+\w+:\s*(Vec|HashMap|HashSet|Option|Result|Box|Rc|Arc)</.test(first100Lines)) {
    return 'rust';
  }

  if (/\bvec!\[/.test(code)) {
    return 'rust';
  }

  if (
    /\bfn\s+\w+\s*\(/.test(first100Lines) &&
    /\b(Option|Result)</.test(first100Lines) &&
    /\.(unwrap_or_default|unwrap_or_else|unwrap_or|expect|ok_or_else|ok_or)\s*\(/.test(code)
  ) {
    return 'rust';
  }

  if (/^#\[(derive|cfg|test|allow|warn|deny)\(/.test(first100Lines)) {
    return 'rust';
  }

  // Rust trait (distinguish from Scala and PHP)
  if (/\btrait\s+\w+/.test(first100Lines)) {
    // Exclude PHP trait (has public/private methods with $)
    if (/\bpublic\s+function/.test(code) && /\$\w+/.test(code)) {
      return null;
    }
    // Rust-specific: trait with Self, impl, fn, or Rust syntax
    if (/\bSelf\b/.test(code) ||
        /\bimpl\s+\w+\s+for\s+/.test(code) ||
        /\bfn\s+\w+\s*\(&self/.test(code) ||
        /\bfn\s+\w+\s*\([^)]*\)\s*->/.test(code) ||
        /\bwhere\s+\w+:\s*\w+/.test(code)) {
      return 'rust';
    }
    // Rust trait definition with fn (not PHP which uses function)
    if (/\btrait\s+\w+\s*\{[\s\S]*?\bfn\s+/.test(code)) {
      return 'rust';
    }
  }

  // Rust impl blocks (strong indicator)
  if (/\bimpl\s+\w+\s+for\s+\w+\s*\{/.test(code)) {
    return 'rust';
  }

  // Rust trait with fn definition (very strong indicator)
  if (/\btrait\s+\w+\s*\{/.test(code) && /\bfn\s+\w+\s*\(/.test(code)) {
    // Check for &self parameter (Rust-specific)
    if (/\bfn\s+\w+\s*\(&self/.test(code) || /\bfn\s+\w+\s*\(&mut\s+self/.test(code)) {
      return 'rust';
    }
    // Or just trait with fn (not Scala which uses def)
    if (!/\bdef\s+\w+/.test(code)) {
      return 'rust';
    }
  }

  // Rust generic function with trait bound
  if (/\bfn\s+\w+<[^>]+:\s*\w+>\s*\(/.test(code)) {
    return 'rust';
  }

  // Rust println! with formatting
  if (/\bprintln!\s*\(\s*"[^"]*\{\}/.test(code)) {
    return 'rust';
  }

  if (/\b(fn\s+main|pub\s+fn|impl\s+\w+|use\s+std::|use\s+self::|extern\s+crate)\b/.test(first100Lines)) {
    return 'rust';
  }

  if (/\bimpl<[^>]+>\s+\w+\s+for\s+\w+/.test(code)) {
    return 'rust';
  }

  if (/\bimpl\s+\w+\s+for\s+\w+\s*\{/.test(code)) {
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
    (sample.includes('println!') || sample.includes('vec!') || sample.includes('macro_rules!') ? 2 : 0) +
    (/\.(unwrap_or_default|unwrap_or_else|unwrap_or|expect|ok_or_else|ok_or)\s*\(/.test(code) ? 1 : 0)
  );

  if (rustScore >= 4) {
    return 'rust';
  }

  return null;
};
