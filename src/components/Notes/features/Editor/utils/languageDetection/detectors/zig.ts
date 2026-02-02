import type { LanguageDetector } from '../types';

export const detectZig: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

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
