import type { LanguageDetector } from '../types';

export const detectObjectiveC: LanguageDetector = (ctx) => {
  const { code, first100Lines } = ctx;

  if (/#import\s+[<"]/.test(first100Lines)) {
    // Foundation/UIKit imports (very distinctive) - immediate match
    if (/#import\s+<(Foundation|UIKit|CoreFoundation|CFNetwork|MobileCoreServices|SystemConfiguration)\//.test(first100Lines)) {
      return 'objective-c';
    }

    if (/\bNS[A-Z]\w+\s*\*/.test(first100Lines)) {
      return 'objective-c';
    }

    if (/@interface\s+\w+|@implementation\s+\w+|@protocol\s+\w+/.test(code)) {
      return 'objective-c';
    }

    if (/[-+]\s*\([^)]+\)\s*\w+/.test(code)) {
      return 'objective-c';
    }

    if (/#import\s+"[\w/]+\.h"/.test(first100Lines) &&
        !/\b(using\s+namespace|std::|template|class\s+\w+\s*:\s*public)\b/.test(first100Lines)) {
      return 'objective-c';
    }
  }

  if (/\b(import\s+.*from|export\s+(default|const|function)|interface\s+\w+)\b/.test(first100Lines)) {
    return null;
  }

  if (!/[{}]/.test(code) && /^%\w+/.test(first100Lines)) {
    return null;
  }

  if (/\b(namespace\s+\w+|class\s+\w+|using\s+namespace)\b/.test(first100Lines)) {
    return null;
  }

  if (/@interface\s+\w+|@implementation\s+\w+/.test(code)) {
    return 'objective-c';
  }

  if (/@protocol\s+\w+/.test(code)) {
    return 'objective-c';
  }

  if (/[-+]\s*\([^)]+\)\s*\w+/.test(code)) {

    if (/@interface|@implementation|@protocol/.test(code)) {
      return 'objective-c';
    }
  }

  if (/@property\s*\([^)]*\)/.test(code)) {
    return 'objective-c';
  }

  if (/\[\w+\s+\w+/.test(code)) {

    if (/@interface|@implementation|@protocol|#import/.test(code)) {
      return 'objective-c';
    }
  }

  return null;
};
