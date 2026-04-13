import type { LanguageDetector } from '../types';

export const detectObjectiveC: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (
    /(?:^|\n)\s*@[a-z_]\w*(?:\.[a-z_]\w*)*(?:\([^)\n]*\))?\s*$/im.test(code) &&
    /(?:^|\n)\s*def\s+\w+\s*\([^)\n]*\)\s*(?:->\s*[^:\n]+)?\s*:/.test(code)
  ) {
    return null;
  }

  if (/(?:^|\n)\s*class\s+\w+(?:\([^)\n]*\))?\s*:/.test(code)) {
    return null;
  }

  const hasModuleImport = /^\s*@import\s+(Foundation|UIKit|CoreFoundation|CFNetwork|MobileCoreServices|SystemConfiguration)\s*;/m.test(first100Lines);
  const hasFrameworkImport = /#import\s+<(Foundation|UIKit|CoreFoundation|CFNetwork|MobileCoreServices|SystemConfiguration)\//.test(first100Lines);
  const hasObjectiveCImport = /#import\s+[<"]/.test(first100Lines);
  const hasNsOrUiType = /\b(?:NS|UI|CF|CG|CA)[A-Z]\w*(?:<[^>\n]+>)?\s*\*/.test(code);
  const hasRuntimeDirective = /@(interface|implementation|protocol|property|dynamic|synthesize|selector|autoreleasepool|synchronized|try|catch|finally)\b/.test(code);
  const hasMethodSignature = /(?:^|\n)\s*[-+]\s*\([^)]+\)\s*\w+(?::[^;{\n]+)?/m.test(code);
  const hasMessageSend = /\[\s*(?:\[[^\]]+\]|self|super|[A-Z]\w*|\w+)\s+(?!in\b)\w+/.test(code);
  const hasObjcQualifiers = /\b(?:__bridge|__weak|__block|nullable|nonnull|_Nullable|_Nonnull)\b/.test(code) || /\bNS_ASSUME_NONNULL_(?:BEGIN|END)\b/.test(code);
  const hasObjcExports = /\bFOUNDATION_EXPORT\b/.test(code) || /\bNS_(?:ENUM|OPTIONS)\b/.test(code);

  if (/^package\s+[\w.]+;/m.test(first100Lines) || /^import\s+java\./m.test(first100Lines)) {
    return null;
  }

  if (/\[(?:weak|unowned|strong)\s+self\]\s+in/.test(code)) {
    return null;
  }

  if (hasModuleImport || hasFrameworkImport) {
    return 'objectivec';
  }

  if (hasRuntimeDirective || hasObjcExports || hasMethodSignature) {
    return 'objectivec';
  }

  if (/\b(import\s+.*from|export\s+(default|const|function))\b/.test(first100Lines)) {
    return null;
  }

  if (!/[{}]/.test(code) && /^%\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(namespace\s+\w+|class\s+\w+|using\s+namespace)\b/.test(first100Lines)) {
    return null;
  }

  if (hasObjcQualifiers && (hasNsOrUiType || hasMessageSend || hasObjectiveCImport || hasModuleImport)) {
    return 'objectivec';
  }

  if (/@autoreleasepool\b/.test(code) && (/\bNSLog\s*\(/.test(code) || hasNsOrUiType || /@\[[\s\S]*\]/.test(code))) {
    return 'objectivec';
  }

  if (hasNsOrUiType && (hasMessageSend || /@\[[\s\S]*\]|@\{[\s\S]*\}|@\(/.test(code))) {
    return 'objectivec';
  }

  if (hasMessageSend && (hasObjectiveCImport || hasNsOrUiType || /\b(?:self|super)\b/.test(code))) {
    return 'objectivec';
  }

  if (/#import\s+"[\w/]+\.h"/.test(first100Lines) && !/\b(std::|template|using\s+namespace|class\s+\w+\s*:\s*public)\b/.test(code)) {
    return 'objectivec';
  }

  return null;
};
