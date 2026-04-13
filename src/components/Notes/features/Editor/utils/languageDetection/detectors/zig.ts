import type { LanguageDetector } from '../types';

export const detectZig: LanguageDetector = (ctx) => {
  const { code, first100Lines, lines } = ctx;
  const trimmed = code.trim();

  if (
    /^#include\s+</m.test(first100Lines) ||
    /\b(?:structuredClone|console\.(?:log|error|warn|info|table)|document\.|window\.|fetch\(|localStorage|sessionStorage|module\.exports|require\(|Promise\.)\b/.test(code) ||
    /\bstd::/.test(code) ||
    /\btemplate\s*</.test(code) ||
    /^use\s+(strict|warnings|lib)\b/m.test(first100Lines) ||
    /\b(?:println|vec|format|matches|panic|todo|unreachable|dbg)!\s*\(/.test(code) ||
    /^import\s+(SwiftUI|Foundation|UIKit|Combine)\b/m.test(first100Lines) ||
    /\bguard\s+let\b/.test(code) ||
    /\bsome\s+View\b/.test(code) ||
    /@(?:State|Published|MainActor|ObservedObject|EnvironmentObject|Binding)\b/.test(code) ||
    /^import\s+.*\s+from\s+['"]/m.test(first100Lines) ||
    /^@import\s+[A-Za-z_]\w*;/m.test(first100Lines) ||
    /@interface\b|@property\b|@implementation\b|@end\b|NS_ASSUME_NONNULL_BEGIN|@"/.test(code)
  ) {
    return null;
  }

  const hasImport = /@import\(["'][^"']+["']\)/.test(code) || /\bconst\s+\w+\s*=\s*@import\(/.test(code);
  const hasBuiltin = /@(import|cImport|cInclude|embedFile|field|typeInfo|TypeOf|panic|compileError|sizeOf|as|intCast|truncate|ptrCast|bitCast|enumFromInt|tagName|hasDecl|Vector)\b/.test(code);
  const hasStd = /\bstd\.(?:io|getStdOut|debug|fmt|mem|heap|fs|json|process|rand|sort|math|time|Thread|atomic|testing|fifo|ascii|unicode)\./.test(code);
  const hasZigFn = /\b(?:pub\s+)?fn\s+\w+\s*\([^)]*\)\s+(?:callconv\(\.C\)\s+)?(?!->)[^{=\n]+\{/.test(code);
  const hasLineStartZigFn = /(?:^|\n)\s*(?:pub\s+)?fn\s+\w+\s*\([^)]*\)\s+(?:callconv\(\.C\)\s+)?(?!->)[^{=\n]+\{/.test(code);
  const hasErrorUnion = /\b(?:anyerror|error\.[A-Za-z_]|[A-Za-z_]\w*!)[A-Za-z_\[?]/.test(code) || /!\s*(?:void|u\d+|i\d+|usize|isize|bool|f\d+|\[\]const\s+u8)\b/.test(code);
  const hasContainers = /\bconst\s+\w+\s*=\s*(?:packed\s+struct|extern\s+struct|struct|enum(?:\([^)]*\))?|union(?:\([^)]*\))?|opaque|error\{)/.test(code);
  const hasContainerLiteral = /\b(?:const|var)\s+\w+(?:\s*:\s*[^=]+)?\s*=\s*\.\{/.test(code);
  const hasArrayLiteral = /\b(?:const|var)\s+\w+(?:\s*:\s*[^=]+)?\s*=\s*\[_(?:[:]\d+)?\](?:\[\]|[A-Za-z0-9_\[\]\s]+)*\s*\{/.test(code);
  const hasTypeInit = /\b(?:const|var)\s+\w+(?:\s*:\s*[^=]+)?\s*=\s*[A-Z][A-Za-z0-9_]*\s*\{/.test(code);
  const hasComptimeConst = /\bconst\s+\w+\s*=\s*comptime\b/.test(code);
  const hasNullOptional = /\b(?:const|var)\s+\w+\s*:\s*\?(?:\[\]const\s+u8|usize|u\d+|i\d+|\*allowzero\s+anyopaque)\s*=\s*null;/.test(code);
  const hasUndefinedInit = /\b(?:const|var)\s+\w+\s*:\s*\[[^\]]+\][^=]+\s*=\s*undefined;/.test(code);
  const hasFieldInit = /\.[A-Za-z_]\w*\s*=/.test(code);
  const hasAnonTuple = /\.\{[^}]+\}/.test(code);
  const hasOptional = /\?\s*(?:\[\]const\s+u8|usize|u\d+|i\d+|\*[A-Za-z_]|\*allowzero\s+anyopaque)/.test(code);
  const hasKeywords = /\b(?:orelse|catch|errdefer|defer|comptime|anytype|anyerror|usingnamespace|undefined|allowzero|suspend|nosuspend|async|await)\b/.test(code);
  const hasLoopSyntax = /\bwhile\s*\([^)]*\)\s*:\s*\([^)]*\)/.test(code) || /\bfor\s*\([^)]*\)\s*\|/.test(code) || /inline\s+for\s*\(/.test(code);
  const hasSwitch = /\bswitch\s*\([^)]*\)\s*\{[\s\S]*\.(?:[a-z]\w*|else)\s*=>/.test(code) || /\d+\.\.\.\d+\s*=>/.test(code);
  const hasPointers = /\*[A-Za-z_][\w.]*\b|\*volatile\s+u\d+|\[\*:0\]const\s+u8|\[_:?0\]u8/.test(code) || /value\.\*/.test(code);
  const hasTests = /^test\s+"[^"]+"\s*\{/m.test(code) || /std\.testing\./.test(code);
  const hasBuild = /\bpub\s+fn\s+build\s*\(b:\s*\*std\.Build\)\s*void/.test(code) || /b\.(?:addExecutable|installArtifact|addRunArtifact|standardTargetOptions|standardOptimizeOption)\(/.test(code);
  const hasCInterop = /@cImport\(|@cInclude\(|\bc_int\b|export\s+fn\s+\w+\s*\(/.test(code);
  const hasLink = /\blinksection\(|callconv\(\.C\)|addrspace\(\.generic\)/.test(code);
  const hasLineString = /^\s*const\s+\w+\s*=\s*\n\s*\\/m.test(code);

  if (hasLineStartZigFn) {
    return 'zig';
  }

  if (lines.length <= 3) {
    if (/^pub\s+fn\s+\w+\s*\([^)]*\)\s+[!A-Za-z_][\w.]*\s*\{/.test(trimmed)) {
      return 'zig';
    }

    if (/^fn\s+\w+\s*\([^)]*\)\s+[!A-Za-z_][\w.]*\s*\{/.test(trimmed) && !/->/.test(trimmed)) {
      return 'zig';
    }
  }

  if (hasImport || hasBuiltin || hasStd || hasBuild || hasCInterop || hasComptimeConst || hasNullOptional || hasUndefinedInit) {
    return 'zig';
  }

  if (hasContainers || hasContainerLiteral || hasArrayLiteral || hasTypeInit) {
    return 'zig';
  }

  if (hasZigFn && (hasErrorUnion || hasKeywords || hasLoopSyntax || hasSwitch || hasPointers || hasOptional || hasFieldInit || /\[\]const\s+u8/.test(code) || /\b[A-Za-z_]\w*!u\d+/.test(code) || /\bbreak\s*:[A-Za-z_]\w+/.test(code))) {
    return 'zig';
  }

  if (hasTests || hasLink || hasLineString || hasAnonTuple || /\[\*:0\]const\s+u8/.test(code)) {
    return 'zig';
  }

  if (/^\s*\.\{[\s\S]*\.minimum_zig_version\s*=/.test(trimmed)) {
    return 'zig';
  }

  return null;
};
