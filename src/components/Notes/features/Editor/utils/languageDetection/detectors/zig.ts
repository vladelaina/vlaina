import type { LanguageDetector } from '../types';

export const detectZig: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;

  if (/^<\?php/m.test(first100Lines) || (/\$\w+\s*=/.test(code) && /\b(echo|print)\b/.test(code))) {
    return null;
  }

  // Simple single-line Zig patterns
  if (lines.length <= 3) {
    const trimmed = code.trim();
    // Zig function: fn add(a: i32, b: i32) i32 { return a + b; }
    if (/^fn\s+\w+\s*\([^)]*\)\s+i\d+\s*\{/.test(trimmed)) {
      return 'zig';
    }
    // Zig pub fn
    if (/^pub\s+fn\s+\w+\s*\([^)]*\)\s+i\d+/.test(trimmed)) {
      return 'zig';
    }
  }

  if (/\b(impl\s+\w+|use\s+std::|fn\s+main\(\)\s*\{)\b/.test(first100Lines)) {

    if (!/@import\(/.test(first100Lines)) {
      return null;
    }
  }

  if (/->|=>/.test(code) && /\brequire\s+['"]/.test(first100Lines)) {
    return null;
  }

  if (/@import\(["'][^"']+["']\)/.test(first100Lines)) {
    return 'zig';
  }

  if (/\bconst\s+\w+\s*=\s*@import/.test(first100Lines)) {
    return 'zig';
  }

  if (/\bconst\s+\w+\s*=\s*std\.\w+/.test(first100Lines)) {
    if (/@\w+\(/.test(first100Lines) || /!\s*void/.test(first100Lines) || /std\.heap\./.test(first100Lines)) {
      return 'zig';
    }
  }

  if (/\bconst\s+ArrayList\s*=\s*std\.ArrayList/.test(code)) {
    return 'zig';
  }

  if (/\bpub\s+fn\s+\w+\s*\([^)]*\)\s+i\d+/.test(code)) {
    return 'zig';
  }

  if (/\btry\s+std\.(io|fs|mem|heap|debug)\./.test(first100Lines)) {
    return 'zig';
  }

  if (/\btry\s+std\.io\.getStdOut\(\)\.writer\(\)\.print/.test(code)) {
    return 'zig';
  }

  if (/\btry\s+std\.io\.getStdOut\(\)/.test(code)) {
    return 'zig';
  }

  if (/std\.io\.getStdOut\(\)\.writer\(\)/.test(code)) {
    return 'zig';
  }

  if (/\bstd\.heap\.\w+/.test(first100Lines)) {
    return 'zig';
  }

  if (/\bstd\.io\.getStdOut\(\)/.test(first100Lines)) {
    return 'zig';
  }

  if (/^\.\{/.test(code.trim())) {

    if (/\.(name|version|minimum_zig_version|paths)\s*=/.test(code)) {
      return 'zig';
    }
  }

  if (/@(import|errorName|as|cImport|embedFile|field|typeInfo|TypeOf|panic|compileError|sizeOf)\b/.test(code)) {
    return 'zig';
  }

  if (/pub\s+fn\s+main\(\)\s*!\w+/.test(code)) {
    return 'zig';
  }

  if (/!\s*(void|u8|u16|u32|u64|i8|i16|i32|i64|bool)\b/.test(code)) {
    if (/\b(const|var|fn)\b/.test(code)) {
      return 'zig';
    }
  }

  if (/\b(pub\s+fn|const\s+\w+\s*=|var\s+\w+\s*=)\b/.test(code)) {

    if (/@\w+\(|!\s*void|anyerror/.test(code)) {
      return 'zig';
    }
  }

  if (/\bcomptime\b/.test(code)) {
    return 'zig';
  }

  if (/\banytype\b/.test(code)) {
    return 'zig';
  }

  if (/\banyerror\b/.test(code)) {
    return 'zig';
  }

  return null;
};
